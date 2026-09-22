import { useEffect, useState } from 'react';
import useReducedMotion from '../../lib/useReducedMotion.js';
import './Flashcard.css';

/**
 * The shared flip card. Used by FlashcardDeck for term/definition and by
 * QuizDeck for question/answer — same flip mechanics, different data.
 *
 * `interactive` decides whether the whole card is the click target. Flashcards
 * flip on any click; the quiz keeps its option buttons clickable instead, so a
 * nested-button structure never happens.
 */
export default function Flashcard({
  front,
  back,
  flipped,
  onFlip,
  interactive = true,
  tone = 'neutral',
  celebrate = false,
  frontLabel = 'Front',
  backLabel = 'Back',
}) {
  const prefersReducedMotion = useReducedMotion();
  const [bouncing, setBouncing] = useState(false);

  // Flourish on a correct reveal — gated on reduced motion: check the
  // preference, skip straight to the end state, return early.
  useEffect(() => {
    if (!celebrate) return;
    if (prefersReducedMotion) return;

    setBouncing(true);
    const timer = setTimeout(() => setBouncing(false), 420);
    return () => clearTimeout(timer);
  }, [celebrate, prefersReducedMotion]);

  const classes = [
    'flip',
    flipped && 'flip--flipped',
    `flip--${tone}`,
    interactive && 'flip--interactive',
    bouncing && 'flip--bounce',
    prefersReducedMotion && 'flip--no-motion',
  ]
    .filter(Boolean)
    .join(' ');

  const activation = interactive
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-pressed': flipped,
        onClick: onFlip,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onFlip?.();
          }
        },
      }
    : {};

  return (
    <div className={classes} {...activation}>
      <div className="flip__inner">
        <div className="flip__face flip__face--front" aria-hidden={flipped}>
          <span className="flip__tag">{frontLabel}</span>
          <div className="flip__content sb-scroll">{front}</div>
          {interactive ? (
            <span className="flip__hint">Click to flip</span>
          ) : null}
        </div>

        <div className="flip__face flip__face--back" aria-hidden={!flipped}>
          <span className="flip__tag">{backLabel}</span>
          <div className="flip__content sb-scroll">{back}</div>
        </div>
      </div>
    </div>
  );
}
