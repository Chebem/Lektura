import { useEffect, useRef, useState } from 'react';
import HoverButton from '../HoverButton/HoverButton.jsx';
import Icon from '../Icon/Icon.jsx';
import './TutorPanel.css';

const SUGGESTIONS = [
  'Summarize this document',
  'Explain the hardest concept here',
  'What Korean terms should I know?',
  'What might be on the exam?',
];

/**
 * One conversation surface, two directions.
 *
 *   ask  — the student asks, Lektura answers from the document
 *   quiz — Lektura asks, the student answers
 *
 * They share the transport, the transcript rendering and the composer;
 * only the system prompt and a little extra chrome differ. Quiz turns also
 * carry structured fields (options, score, progress) which render as
 * controls above the input.
 *
 * Each mode keeps its own transcript so switching doesn't splice two
 * unrelated conversations together in the model's history.
 */
export default function TutorPanel({
  mode,
  onModeChange,
  messages,
  turn,
  onSend,
  onStartQuiz,
  busy,
  disabled,
  disabledReason,
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!endRef.current) return;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      return;
    }
    endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  function submit(text) {
    const value = (text ?? draft).trim();
    if (!value || busy || disabled) return;
    setDraft('');
    onSend(value);
  }

  const quizStarted = mode === 'quiz' && messages.length > 0;

  return (
    <div className="tutor">
      <div className="tutor__modes" role="tablist" aria-label="Tutor mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ask'}
          className={`tutor__mode${mode === 'ask' ? ' tutor__mode--active' : ''}`}
          onClick={() => onModeChange('ask')}
        >
          Ask
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'quiz'}
          className={`tutor__mode${mode === 'quiz' ? ' tutor__mode--active' : ''}`}
          onClick={() => onModeChange('quiz')}
        >
          Quiz me
        </button>

        {mode === 'quiz' && turn?.score?.answered > 0 ? (
          <span className="tutor__score">
            <Icon name="score" size={13} />
            {turn.score.correct}/{turn.score.answered}
          </span>
        ) : null}
      </div>

      <div className="tutor__log sb-scroll" ref={listRef}>
        {messages.length === 0 ? (
          <div className="tutor__intro">
            {mode === 'ask' ? (
              <>
                <p className="tutor__intro-title">Ask about this document</p>
                <p className="tutor__intro-text">
                  Answers come only from the document you uploaded. If
                  something isn't in it, Lektura says so instead of guessing.
                </p>
                {!disabled ? (
                  <div className="tutor__suggestions">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="tutor__suggestion"
                        onClick={() => submit(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="tutor__intro-title">Get quizzed on this document</p>
                <p className="tutor__intro-text">
                  About ten questions, one at a time. Pick an option or type
                  your answer — and ask for a hint whenever you're stuck.
                </p>
                <HoverButton
                  variant="accent"
                  size="sm"
                  disabled={disabled}
                  onClick={onStartQuiz}
                >
                  Start the quiz
                </HoverButton>
              </>
            )}
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`tutor__msg tutor__msg--${message.role}${
              message.isError ? ' tutor__msg--error' : ''
            }`}
          >
            <span className="tutor__role">
              {message.role === 'user' ? 'You' : 'Lektura'}
            </span>
            <div className="tutor__bubble">
              {message.content.split(/\n+/).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="tutor__msg tutor__msg--assistant">
            <span className="tutor__role">Lektura</span>
            <div className="tutor__bubble tutor__bubble--typing">
              <span className="tutor__dot" />
              <span className="tutor__dot" />
              <span className="tutor__dot" />
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Quiz controls: the current question's options and progress. */}
      {mode === 'quiz' && quizStarted && turn && !busy ? (
        <div className="tutor__quizbar">
          {turn.question && turn.totalQuestions ? (
            <div className="tutor__progress">
              <span>
                Question {turn.questionNumber} of {turn.totalQuestions}
              </span>
              <div className="tutor__progress-track">
                <div
                  className="tutor__progress-fill"
                  style={{
                    width: `${((turn.questionNumber - 1) / turn.totalQuestions) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {turn.options.length > 0 ? (
            <div
              className={`tutor__options${
                turn.questionType === 'true_false' ? ' tutor__options--tf' : ''
              }`}
            >
              {turn.options.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  className="tutor__option"
                  onClick={() => submit(option)}
                >
                  <span className="tutor__option-key">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {turn.question ? (
            <button
              type="button"
              className="tutor__hint"
              onClick={() => submit('Give me a hint, but do not tell me the answer.')}
            >
              <Icon name="concept" size={13} /> Ask for a hint
            </button>
          ) : null}

          {turn.finished ? (
            <HoverButton variant="accent" size="sm" onClick={onStartQuiz}>
              Start a new quiz
            </HoverButton>
          ) : null}
        </div>
      ) : null}

      <form
        className="tutor__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="tutor__input"
          rows={1}
          value={draft}
          placeholder={
            disabled
              ? disabledReason
              : mode === 'quiz'
                ? 'Type your answer, or ask for a hint…'
                : 'Ask a question…'
          }
          disabled={disabled || busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <HoverButton
          type="submit"
          variant="accent"
          size="sm"
          busy={busy}
          disabled={disabled || !draft.trim()}
          title="Send"
        >
          Send
        </HoverButton>
      </form>
    </div>
  );
}
