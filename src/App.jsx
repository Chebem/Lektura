import { useCallback, useEffect, useState } from 'react';
import AppHeader from './components/AppHeader/AppHeader.jsx';
import PdfViewer from './components/PdfViewer/PdfViewer.jsx';
import TranslationPanel from './components/TranslationPanel/TranslationPanel.jsx';
import FlashcardDeck from './components/FlashcardDeck/FlashcardDeck.jsx';
import TutorPanel from './components/TutorPanel/TutorPanel.jsx';
import PaneBar, { PANES } from './components/PaneBar/PaneBar.jsx';
import HoverButton from './components/HoverButton/HoverButton.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import {
  checkProvider,
  uploadPdf,
  getTranslation,
  askChatbot,
  getFlashcards,
  askQuizTutor,
} from './lib/aiClient.js';
import { QUIZ_TUTOR_OPENING } from './data/promptTemplates.js';
import './App.css';

/** One holder for each AI-backed result: data plus its own status/error. */
const emptyResource = { data: null, status: 'idle', error: null };

/**
 * Stable identity for "no cards yet". An inline `[]` would be a new array on
 * every render, refiring FlashcardDeck's reset effect and losing the
 * student's place in the deck whenever App re-rendered for any other reason.
 */
const NO_CARDS = [];

export default function App() {
  // --- Session state (in memory only; a refresh resets it, by design) -----
  const [profile, setProfile] = useState({
    koreanLevel: null,
    learningGoal: null,
  });

  const [file, setFile] = useState(null);
  // Descriptor returned by the upload: a Files API reference for Gemini, or
  // inline bytes for providers without direct upload. Passed to every AI call.
  const [source, setSource] = useState(null);
  const [docMeta, setDocMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [translation, setTranslation] = useState(emptyResource);
  const [flashcards, setFlashcards] = useState(emptyResource);

  // The tutor is one surface with two directions. Each keeps its own
  // transcript so switching modes doesn't splice unrelated conversations
  // together in the model's history.
  const [tutorMode, setTutorMode] = useState('ask');
  const [askMessages, setAskMessages] = useState([]);
  const [quizMessages, setQuizMessages] = useState([]);
  const [quizTurn, setQuizTurn] = useState(null);
  const [tutorBusy, setTutorBusy] = useState(false);

  const [layout, setLayout] = useState('dual');
  const [panes, setPanes] = useState(['document', 'translation']);
  const [theme, setTheme] = useState(null);
  const [provider, setProvider] = useState(null);

  const profileComplete = Boolean(profile.koreanLevel && profile.learningGoal);
  const ready = Boolean(source && profileComplete);

  // --- Theme ---------------------------------------------------------------
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(prefersDark.matches ? 'dark' : 'light');

    const onChange = (event) => setTheme(event.matches ? 'dark' : 'light');
    prefersDark.addEventListener('change', onChange);
    return () => prefersDark.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // --- Provider status (is a key configured?) ------------------------------
  useEffect(() => {
    checkProvider().then(setProvider);
  }, []);

  // --- Upload --------------------------------------------------------------
  async function handleFileChosen(event) {
    const chosen = event.target.files?.[0];
    // Reset the input so re-picking the same file still fires a change event.
    event.target.value = '';
    if (!chosen) return;

    setUploading(true);
    setUploadError(null);

    try {
      const uploaded = await uploadPdf(chosen);

      // A new document invalidates everything generated from the old one.
      setFile(chosen);
      setSource(uploaded);
      setDocMeta({ name: uploaded.name, bytes: uploaded.size });
      setTranslation(emptyResource);
      setFlashcards(emptyResource);
      setAskMessages([]);
      setQuizMessages([]);
      setQuizTurn(null);
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  }

  // --- Generation ----------------------------------------------------------
  /** Shared runner so all three generators get identical status handling. */
  const run = useCallback(
    async (setter, task) => {
      if (!ready) return;
      setter({ data: null, status: 'loading', error: null });
      try {
        const data = await task();
        setter({ data, status: 'ready', error: null });
      } catch (error) {
        console.error('[StudyBridge] generation failed', error);
        setter({ data: null, status: 'error', error });
      }
    },
    [ready],
  );

  const generateTranslation = useCallback(
    () => run(setTranslation, () => getTranslation(source, profile)),
    [run, source, profile],
  );

  const generateFlashcards = useCallback(
    () => run(setFlashcards, () => getFlashcards(source, profile)),
    [run, source, profile],
  );

  // --- Tutor ---------------------------------------------------------------
  const isQuiz = tutorMode === 'quiz';
  const tutorMessages = isQuiz ? quizMessages : askMessages;

  async function sendTutorMessage(text, { silent = false } = {}) {
    const setMessages = isQuiz ? setQuizMessages : setAskMessages;
    const history = tutorMessages.filter((message) => !message.isError);

    if (!silent) {
      setMessages((current) => [
        ...current,
        { id: `m-${Date.now()}`, role: 'user', content: text },
      ]);
    }
    setTutorBusy(true);

    try {
      if (isQuiz) {
        const turn = await askQuizTutor(source, profile, history, text);
        setQuizTurn(turn);

        // The transcript shows what the tutor says; the structured fields
        // drive the option buttons and progress below it.
        const parts = [turn.reply, turn.explanation, turn.question].filter(
          Boolean,
        );
        setMessages((current) => [
          ...current,
          {
            id: `m-${Date.now()}-a`,
            role: 'assistant',
            content: parts.join('\n\n'),
          },
        ]);
      } else {
        const answer = await askChatbot(source, profile, history, text);
        setMessages((current) => [
          ...current,
          { id: `m-${Date.now()}-a`, role: 'assistant', content: answer },
        ]);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `m-${Date.now()}-e`,
          role: 'assistant',
          content: error.hint ? `${error.message} ${error.hint}` : error.message,
          isError: true,
        },
      ]);
    } finally {
      setTutorBusy(false);
    }
  }

  function startQuiz() {
    setQuizMessages([]);
    setQuizTurn(null);
    setTutorMode('quiz');
    // The opening turn has no student message to show.
    sendTutorMessage(QUIZ_TUTOR_OPENING, { silent: true });
  }

  // --- Panes ----------------------------------------------------------------
  function selectPane(id) {
    setPanes((current) => {
      if (layout === 'single') return [id];
      if (current.includes(id)) {
        // Never leave dual mode with nothing on screen.
        return current.length > 1 ? current.filter((p) => p !== id) : current;
      }
      return current.length < 2 ? [...current, id] : [current[1], id];
    });
  }

  function changeLayout(next) {
    setLayout(next);
    setPanes((current) =>
      next === 'single' ? [current[0]] : current.length === 2 ? current : [current[0], 'tutor'],
    );
  }

  const onDocumentLoad = useCallback(({ pageCount }) => {
    setDocMeta((current) => ({ ...current, pageCount }));
  }, []);

  // --- Render --------------------------------------------------------------
  // --- Render ---------------------------------------------------------------

  /** One pane, rendered by id. Shared by both layouts. */
  function renderPane(id) {
    const meta = PANES.find((pane) => pane.id === id);

    if (id === 'document') {
      return (
        <section className="panel" key={id}>
          <div className="panel__head">
            <h2 className="panel__title">Original document</h2>
            {docMeta?.pageCount ? (
              <span className="panel__meta">{docMeta.pageCount} pages</span>
            ) : null}
          </div>
          <div className="panel__body">
            <PdfViewer file={file} onDocumentLoad={onDocumentLoad} />
          </div>
        </section>
      );
    }

    if (id === 'translation') {
      return (
        <section className="panel" key={id}>
          <div className="panel__head">
            <h2 className="panel__title">English translation</h2>
            <HoverButton
              variant="ghost"
              size="sm"
              disabled={!ready}
              busy={translation.status === 'loading'}
              onClick={generateTranslation}
            >
              {translation.data ? 'Regenerate' : 'Translate'}
            </HoverButton>
          </div>
          <div className="panel__body">
            <TranslationPanel
              translation={translation.data}
              status={translation.status}
              error={translation.error}
              onRetry={generateTranslation}
            />
          </div>
        </section>
      );
    }

    if (id === 'cards') {
      return (
        <section className="panel" key={id}>
          <div className="panel__head">
            <h2 className="panel__title">Learning cards</h2>
            {flashcards.data ? (
              <span className="panel__meta">
                {flashcards.data.cards.length} cards
              </span>
            ) : null}
          </div>
          <div className="panel__body panel__body--scroll sb-scroll">
            <FlashcardDeck
              cards={flashcards.data?.cards ?? NO_CARDS}
              status={flashcards.status}
              error={flashcards.error}
              onGenerate={generateFlashcards}
              onRetry={generateFlashcards}
              ready={ready}
            />
          </div>
        </section>
      );
    }

    return (
      <section className="panel" key={id}>
        <div className="panel__head">
          <h2 className="panel__title">{meta?.label ?? 'Tutor'}</h2>
        </div>
        <div className="panel__body">
          <TutorPanel
            mode={tutorMode}
            onModeChange={setTutorMode}
            messages={tutorMessages}
            turn={quizTurn}
            onSend={(text) => sendTutorMessage(text)}
            onStartQuiz={startQuiz}
            busy={tutorBusy}
            disabled={!ready}
            disabledReason={
              profileComplete
                ? 'Upload a document to start'
                : 'Set your study profile first'
            }
          />
        </div>
      </section>
    );
  }

  return (
    <div className="app">
      <AppHeader
        documentName={docMeta?.name}
        pageCount={docMeta?.pageCount}
        profile={profile}
        onProfileChange={setProfile}
        profileComplete={profileComplete}
        profileLocked={Boolean(translation.data || flashcards.data)}
        hasDocument={Boolean(file)}
        uploading={uploading}
        onFileChosen={handleFileChosen}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <PaneBar
          layout={layout}
          onLayoutChange={changeLayout}
          active={panes}
          onSelect={selectPane}
        />
      </AppHeader>

      {provider && !provider.configured ? (
        <div className="app__banner" role="status">
          <strong>No API key configured.</strong> The document viewer works,
          but translation, the tutor and learning cards need a key.{' '}
          {provider.hint}
        </div>
      ) : null}

      {uploadError ? (
        <div className="sb-error app__upload-error">
          <span className="sb-error__title">Upload failed</span>
          <span>{uploadError.message}</span>
          {uploadError.hint ? <span>{uploadError.hint}</span> : null}
        </div>
      ) : null}

      <main className="app__body">
        <ErrorBoundary resetKey={panes.join('+')}>
          <div
            className={`workspace workspace--${layout}`}
            data-panes={panes.length}
          >
            {panes.map(renderPane)}
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
