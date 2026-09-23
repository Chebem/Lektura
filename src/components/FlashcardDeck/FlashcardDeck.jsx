import { useEffect, useMemo, useState } from 'react';
import Flashcard from './Flashcard.jsx';
import { CardBadges, CardFront, CardBack, CATEGORY_ICONS } from './CardFace.jsx';
import Icon from '../Icon/Icon.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
import { CARD_CATEGORIES } from '../../data/promptTemplates.js';
import './FlashcardDeck.css';

/**
 * The learning-card deck.
 *
 * Two ways to work through it, which serve different needs:
 *   - **stack** — one flip card at a time, for actually drilling yourself
 *   - **grid**  — every card open at once, for browsing and revision
 *
 * Mastery is tracked per card ("known" vs "still learning") rather than mere
 * exposure, because having seen a card says nothing about recalling it.
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
  const [view, setView] = useState('stack');
  const [category, setCategory] = useState('All');
  const [examOnly, setExamOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [mastery, setMastery] = useState({});

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setMastery({});
    setCategory('All');
    setExamOnly(false);
    setQuery('');
  }, [cards]);

  const counts = useMemo(() => {
    const result = { All: cards.length, exam: 0 };
    for (const name of CARD_CATEGORIES) result[name] = 0;
    for (const card of cards) {
      result[card.category] = (result[card.category] ?? 0) + 1;
      if (card.examPriority) result.exam += 1;
    }
    return result;
  }, [cards]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (category !== 'All' && card.category !== category) return false;
      if (examOnly && !card.examPriority) return false;
      if (!needle) return true;
      return [
        card.term,
        card.romanization,
        card.translation,
        card.courseMeaning,
        card.generalMeaning,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [cards, category, examOnly, query]);

  // Filtering can leave the cursor past the end of the filtered list.
  const safeIndex = Math.min(index, Math.max(visible.length - 1, 0));
  useEffect(() => {
    if (index !== safeIndex) {
      setIndex(safeIndex);
      setFlipped(false);
    }
  }, [index, safeIndex]);

  const masteredCount = useMemo(
    () => Object.values(mastery).filter((value) => value === 'known').length,
    [mastery],
  );

  function go(delta) {
    const next = safeIndex + delta;
    if (next < 0 || next >= visible.length) return;
    setIndex(next);
    setFlipped(false);
  }

  function mark(cardId, value) {
    setMastery((current) => ({ ...current, [cardId]: value }));
    if (safeIndex < visible.length - 1) go(1);
  }

  useEffect(() => {
    if (view !== 'stack' || visible.length === 0) return;
    function onKeyDown(event) {
      if (event.target.tagName === 'INPUT') return;
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === ' ') {
        event.preventDefault();
        setFlipped((value) => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, visible.length, safeIndex]);

  if (status === 'loading') {
    return (
      <div className="sb-loading">
        <div className="sb-loading__bar" />
        <span>Building learning cards from your document…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <span className="sb-error__title">Couldn't generate learning cards</span>
        <span>{error?.message}</span>
        {error?.hint ? <span>{error.hint}</span> : null}
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="sb-empty">
        <span className="sb-empty__icon" aria-hidden="true">
          <Icon name="cards" size={22} />
        </span>
        <span className="sb-empty__title">No learning cards yet</span>
        <span className="sb-empty__hint">
          {ready
            ? 'Pull the key terms, patterns and concepts out of this document and drill them.'
            : 'Upload a document and set your study profile first.'}
        </span>
        <HoverButton variant="accent" onClick={onGenerate} disabled={!ready}>
          Generate learning cards
        </HoverButton>
      </div>
    );
  }

  const card = visible[safeIndex];

  return (
    <div className="deck">
      {/* Filters */}
      <div className="deck__filters">
        <div className="deck__chips">
          <FilterChip
            label="All"
            count={counts.All}
            active={category === 'All' && !examOnly}
            onClick={() => {
              setCategory('All');
              setExamOnly(false);
            }}
          />
          {CARD_CATEGORIES.filter((name) => counts[name] > 0).map((name) => (
            <FilterChip
              key={name}
              icon={CATEGORY_ICONS[name]}
              label={name}
              count={counts[name]}
              active={category === name}
              onClick={() => {
                setCategory(name);
                setExamOnly(false);
              }}
            />
          ))}
          {counts.exam > 0 ? (
            <FilterChip
              icon="exam"
              label="Exam Focus"
              count={counts.exam}
              active={examOnly}
              tone="exam"
              onClick={() => {
                setExamOnly((value) => !value);
                setCategory('All');
              }}
            />
          ) : null}
        </div>

        <div className="deck__tools">
          <input
            className="deck__search"
            type="search"
            value={query}
            placeholder="Filter cards…"
            aria-label="Filter cards"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="deck__view" role="group" aria-label="View mode">
            <button
              type="button"
              className={`deck__view-btn${view === 'grid' ? ' deck__view-btn--active' : ''}`}
              onClick={() => setView('grid')}
              title="Grid view"
              aria-pressed={view === 'grid'}
            >
              <Icon name="grid" size={15} />
            </button>
            <button
              type="button"
              className={`deck__view-btn${view === 'stack' ? ' deck__view-btn--active' : ''}`}
              onClick={() => setView('stack')}
              title="Stack view"
              aria-pressed={view === 'stack'}
            >
              <Icon name="stack" size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="deck__progress-bar">
        <span className="deck__progress-label">
          Study progress: <strong>{masteredCount}</strong> of {cards.length}{' '}
          cards mastered
        </span>
        <div className="deck__progress-track">
          <div
            className="deck__progress-fill"
            style={{ width: `${(masteredCount / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="deck__none">No cards match that filter.</p>
      ) : view === 'grid' ? (
        <div className="deck__grid">
          {visible.map((item) => (
            <article
              key={item.id}
              className={`deck__gridcard${
                mastery[item.id] === 'known' ? ' deck__gridcard--known' : ''
              }`}
            >
              <CardBadges card={item} />
              <p className="deck__gridterm" lang="ko">
                {item.term}
                {item.romanization ? (
                  <span className="deck__gridrom"> [{item.romanization}]</span>
                ) : null}
              </p>
              <CardBack card={item} />
            </article>
          ))}
        </div>
      ) : (
        <>
          <Flashcard
            flipped={flipped}
            onFlip={() => setFlipped((value) => !value)}
            frontLabel={`Card ${safeIndex + 1} of ${visible.length}`}
            backLabel="Meaning"
            front={<CardFront card={card} />}
            back={<CardBack card={card} />}
          />

          <div className="deck__controls">
            <HoverButton
              variant="quiet"
              icon={<Icon name="prev" size={16} />}
              aria-label="Previous card"
              disabled={safeIndex === 0}
              onClick={() => go(-1)}
            />
            <div className="deck__mastery">
              <button
                type="button"
                className="deck__mark deck__mark--again"
                onClick={() => mark(card.id, 'learning')}
              >
                Still learning
              </button>
              <button
                type="button"
                className="deck__mark deck__mark--known"
                onClick={() => mark(card.id, 'known')}
              >
                I know this
              </button>
            </div>
            <HoverButton
              variant="quiet"
              icon={<Icon name="next" size={16} />}
              aria-label="Next card"
              disabled={safeIndex >= visible.length - 1}
              onClick={() => go(1)}
            />
          </div>

          <p className="deck__hint">
            Space flips · arrow keys move
          </p>
        </>
      )}

      <div className="deck__footer">
        <HoverButton variant="ghost" size="sm" onClick={onGenerate}>
          Regenerate
        </HoverButton>
      </div>
    </div>
  );
}

function FilterChip({ icon, label, count, active, onClick, tone }) {
  return (
    <button
      type="button"
      className={[
        'deck__chip',
        active && 'deck__chip--active',
        tone === 'exam' && 'deck__chip--exam',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {label}
      <span className="deck__chip-count">{count}</span>
    </button>
  );
}
