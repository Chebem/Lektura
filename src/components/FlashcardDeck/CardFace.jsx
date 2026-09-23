import './CardFace.css';

const CATEGORY_ICONS = {
  Vocab: '📚',
  Terminology: '🔬',
  'Sentence Pattern': '💬',
  Grammar: '📝',
  Concept: '💡',
};

/** Category + exam-priority chips, shared by both faces and the grid view. */
export function CardBadges({ card }) {
  return (
    <div className="cardface__badges">
      <span
        className={`cardface__badge cardface__badge--${card.category
          .toLowerCase()
          .replace(/\s+/g, '-')}`}
      >
        <span aria-hidden="true">{CATEGORY_ICONS[card.category] ?? '📚'}</span>{' '}
        {card.category}
      </span>
      {card.examPriority ? (
        <span className="cardface__badge cardface__badge--exam">
          <span aria-hidden="true">★</span> Exam Priority
        </span>
      ) : null}
    </div>
  );
}

/** Front: the term to recall from. Deliberately withholds the translation. */
export function CardFront({ card }) {
  return (
    <>
      <CardBadges card={card} />
      <div className="cardface__term-block">
        <p className="cardface__term" lang="ko">
          {card.term}
        </p>
        {card.romanization ? (
          <p className="cardface__romanization">[{card.romanization}]</p>
        ) : null}
      </div>
    </>
  );
}

/** Back: translation, both meanings, and a worked example. */
export function CardBack({ card }) {
  return (
    <>
      <p className="cardface__translation">{card.translation}</p>

      {card.generalMeaning ? (
        <p className="cardface__meaning">
          <span className="cardface__meaning-label">Generally</span>
          {card.generalMeaning}
        </p>
      ) : null}

      {card.courseMeaning ? (
        <p className="cardface__meaning">
          <span className="cardface__meaning-label">In this material</span>
          {card.courseMeaning}
        </p>
      ) : null}

      {card.exampleKo ? (
        <div className="cardface__example">
          <p lang="ko">{card.exampleKo}</p>
          {card.exampleEn ? (
            <p className="cardface__example-en">{card.exampleEn}</p>
          ) : null}
        </div>
      ) : null}

      {card.source ? (
        <p className="cardface__source">From: {card.source}</p>
      ) : null}
    </>
  );
}
