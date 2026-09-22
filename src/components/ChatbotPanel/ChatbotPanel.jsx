import { useEffect, useRef, useState } from 'react';
import HoverButton from '../HoverButton/HoverButton.jsx';
import './ChatbotPanel.css';

const SUGGESTIONS = [
  'Summarize this document',
  'Explain the hardest concept here',
  'What Korean terms should I know?',
  'What might be on the exam?',
];

/**
 * Chat grounded in the uploaded document.
 *
 * History lives in App so the conversation survives tab switches — the spec
 * asks for a chatbot that persists across tabs, so this component is
 * deliberately stateless apart from the draft input.
 */
export default function ChatbotPanel({
  messages,
  onSend,
  busy,
  disabled,
  disabledReason,
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const endRef = useRef(null);

  // Follow the conversation as it grows, honouring reduced motion.
  useEffect(() => {
    if (!endRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
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

  return (
    <div className="chat">
      <div className="chat__log sb-scroll" ref={listRef}>
        {messages.length === 0 ? (
          <div className="chat__intro">
            <p className="chat__intro-title">Ask about this document</p>
            <p className="chat__intro-text">
              Answers come only from the PDF you uploaded. If something isn't
              in it, the assistant will say so instead of guessing.
            </p>
            {!disabled ? (
              <div className="chat__suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="chat__suggestion"
                    onClick={() => submit(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat__msg chat__msg--${message.role}${
              message.isError ? ' chat__msg--error' : ''
            }`}
          >
            <span className="chat__role">
              {message.role === 'user' ? 'You' : 'StudyBridge'}
            </span>
            <div className="chat__bubble">
              {message.content.split(/\n+/).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="chat__msg chat__msg--assistant">
            <span className="chat__role">StudyBridge</span>
            <div className="chat__bubble chat__bubble--typing">
              <span className="chat__dot" />
              <span className="chat__dot" />
              <span className="chat__dot" />
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        className="chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="chat__input"
          rows={1}
          value={draft}
          placeholder={disabled ? disabledReason : 'Ask a question…'}
          disabled={disabled || busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter makes a new line.
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
