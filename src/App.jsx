import { useCallback, useEffect, useState } from 'react';
import AppHeader from './components/AppHeader/AppHeader.jsx';
import PdfViewer from './components/PdfViewer/PdfViewer.jsx';
import TranslationPanel from './components/TranslationPanel/TranslationPanel.jsx';
import ChatbotPanel from './components/ChatbotPanel/ChatbotPanel.jsx';
import FlashcardDeck from './components/FlashcardDeck/FlashcardDeck.jsx';
import QuizDeck from './components/QuizDeck/QuizDeck.jsx';
import HoverButton from './components/HoverButton/HoverButton.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import {
  checkProvider,
  uploadPdf,
  getTranslation,
  askChatbot,
  getFlashcards,
  getQuiz,
} from './lib/aiClient.js';
import './App.css';

const TABS = [
  { id: 'document', label: 'Document & Translation' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
];

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
  const [quiz, setQuiz] = useState(emptyResource);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);

  const [activeTab, setActiveTab] = useState('document');
  const [showChat, setShowChat] = useState(true);
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
      setQuiz(emptyResource);
      setChatMessages([]);
      setActiveTab('document');
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

  const generateQuiz = useCallback(
    () => run(setQuiz, () => getQuiz(source, profile)),
    [run, source, profile],
  );

  // --- Chat ----------------------------------------------------------------
  async function handleSend(text) {
    const userMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: text,
    };

    // Snapshot the history *before* this turn — the model shouldn't receive
    // the question twice.
    const history = chatMessages.filter((message) => !message.isError);

    setChatMessages((current) => [...current, userMessage]);
    setChatBusy(true);

    try {
      const answer = await askChatbot(source, profile, history, text);
      setChatMessages((current) => [
        ...current,
        { id: `m-${Date.now()}-a`, role: 'assistant', content: answer },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: `m-${Date.now()}-e`,
          role: 'assistant',
          content: error.hint
            ? `${error.message} ${error.hint}`
            : error.message,
          isError: true,
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const onDocumentLoad = useCallback(({ pageCount }) => {
    setDocMeta((current) => ({ ...current, pageCount }));
  }, []);

  // --- Render --------------------------------------------------------------
  const tabsWithBadges = TABS.map((tab) => {
    if (tab.id === 'flashcards' && flashcards.data)
      return { ...tab, badge: flashcards.data.cards.length };
    if (tab.id === 'quiz' && quiz.data)
      return { ...tab, badge: quiz.data.questions.length };
    return tab;
  });

  return (
    <div className="app">
      <AppHeader
        documentName={docMeta?.name}
        pageCount={docMeta?.pageCount}
        profile={profile}
        onProfileChange={setProfile}
        profileComplete={profileComplete}
        profileLocked={Boolean(translation.data || flashcards.data || quiz.data)}
        hasDocument={Boolean(file)}
        uploading={uploading}
        onFileChosen={handleFileChosen}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        tabs={tabsWithBadges}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {provider && !provider.configured ? (
        <div className="app__banner" role="status">
          <strong>No API key configured.</strong> The PDF viewer works, but
          translation, chat, flashcards and the quiz need a key.{' '}
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
        <ErrorBoundary resetKey={activeTab}>
        {activeTab === 'document' ? (
          <div
            className={`workspace${showChat ? ' workspace--with-chat' : ''}`}
            id="panel-document"
            role="tabpanel"
            aria-labelledby="tab-document"
          >
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Original document</h2>
                {docMeta?.pageCount ? (
                  <span className="panel__meta">
                    {docMeta.pageCount} pages
                  </span>
                ) : null}
              </div>
              <div className="panel__body">
                <PdfViewer file={file} onDocumentLoad={onDocumentLoad} />
              </div>
            </section>

            <section className="panel">
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

            {showChat ? (
              <section className="panel">
                <div className="panel__head">
                  <h2 className="panel__title">AI study chatbot</h2>
                  <HoverButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChat(false)}
                    title="Hide the chatbot"
                  >
                    Hide
                  </HoverButton>
                </div>
                <div className="panel__body">
                  <ChatbotPanel
                    messages={chatMessages}
                    onSend={handleSend}
                    busy={chatBusy}
                    disabled={!ready}
                    disabledReason={
                      profileComplete
                        ? 'Upload a PDF to start asking questions'
                        : 'Set your study profile first'
                    }
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {!showChat && activeTab === 'document' ? (
          <HoverButton
            className="app__chat-fab"
            variant="accent"
            onClick={() => setShowChat(true)}
          >
            Show chatbot
          </HoverButton>
        ) : null}

        {activeTab === 'flashcards' ? (
          <div
            className="stage"
            id="panel-flashcards"
            role="tabpanel"
            aria-labelledby="tab-flashcards"
          >
            <FlashcardDeck
              cards={flashcards.data?.cards ?? NO_CARDS}
              status={flashcards.status}
              error={flashcards.error}
              onGenerate={generateFlashcards}
              onRetry={generateFlashcards}
              ready={ready}
            />
          </div>
        ) : null}

        {activeTab === 'quiz' ? (
          <div
            className="stage"
            id="panel-quiz"
            role="tabpanel"
            aria-labelledby="tab-quiz"
          >
            <QuizDeck
              quiz={quiz.data}
              status={quiz.status}
              error={quiz.error}
              onGenerate={generateQuiz}
              onRetry={generateQuiz}
              ready={ready}
            />
          </div>
        ) : null}
        </ErrorBoundary>
      </main>
    </div>
  );
}
