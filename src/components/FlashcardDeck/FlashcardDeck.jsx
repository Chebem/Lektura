import { useEffect, useState } from 'react';
import Flashcard from './Flashcard.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
import './FlashcardDeck.css';

/**
 * Deck of AI-generated cards: term on the front, definition on the back.
 * Flip on click, prev/next through the deck, arrow keys for both.
 */
export default function FlashcardDeck({
  cards,
  status,
  error,
  onGenerate,
  onRetry,
  ready,
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(() => new Set());

  const total = cards?.length ?? 0;

  // A new deck resets position and progress.
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setSeen(new Set());
  }, [cards]);

  useEffect(() => {
    if (total === 0) return;

    function onKeyDown(event) {
      if (event.key === 'ArrowRight' && index < total - 1) {
        setIndex(index + 1);
        setFlipped(false);
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        setIndex(index - 1);
        setFlipped(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [total, index]);

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next >= total) return;
    setIndex(next);
    setFlipped(false);
  }

  function flip() {
    // Revealing the back counts as reviewing the card.
    if (!flipped) setSeen((prev) => new Set(prev).add(index));
    setFlipped(!flipped);
  }

  if (status === 'loading') {
    return (
      <div className="sb-loading">
        <div className="sb-loading__bar" />
        <span>Building flashcards from your document…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <span className="sb-error__title">Couldn't generate flashcards</span>
        <span>{error?.message}</span>
        {error?.hint ? <span>{error.hint}</span> : null}
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="sb-empty">
        <span className="sb-empty__icon" aria-hidden="true">
          ⚡
        </span>
        <span className="sb-empty__title">No flashcards yet</span>
        <span className="sb-empty__hint">
          {ready
            ? 'Pull the key terms out of this document and drill them as a deck.'
            : 'Upload a document and set your study profile first.'}
        </span>
        <HoverButton variant="accent" onClick={onGenerate} disabled={!ready}>
          Generate flashcards
        </HoverButton>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="deck">
      <div className="section-heading deck__heading">
        <span className="section-num">01</span>
        <h2>Flashcards</h2>
        <span className="section-line" />
        <span className="deck__counter">
          {index + 1} / {total}
        </span>
      </div>

      <Flashcard
        flipped={flipped}
        onFlip={flip}
        frontLabel="Term"
        backLabel="Meaning"
        front={<p className="deck__term">{card.front}</p>}
        back={
          <>
            <p className="deck__definition">{card.back}</p>
            {card.source ? (
              <p className="deck__source">From: {card.source}</p>
            ) : null}
          </>
        }
      />

      <div className="deck__controls">
        <HoverButton
          variant="quiet"
          icon="‹"
          aria-label="Previous card"
          disabled={index === 0}
          onClick={() => go(-1)}
        />

        <div className="deck__progress" aria-hidden="true">
          {cards.map((item, cardIndex) => (
            <span
              key={item.id}
              className={[
                'deck__pip',
                cardIndex === index && 'deck__pip--current',
                seen.has(cardIndex) && 'deck__pip--seen',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>

        <HoverButton
          variant="quiet"
          icon="›"
          aria-label="Next card"
          disabled={index >= total - 1}
          onClick={() => go(1)}
        />
      </div>

      <div className="deck__footer">
        <span className="deck__hint">
          {seen.size} of {total} reviewed · arrow keys to move
        </span>
        <HoverButton variant="ghost" size="sm" onClick={onGenerate}>
          Regenerate
        </HoverButton>
      </div>
    </div>
  );
}
