import { useEffect, useMemo, useState } from 'react';
import Flashcard from '../FlashcardDeck/Flashcard.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
import Icon from '../Icon/Icon.jsx';
import './QuizDeck.css';

/**
 * Quiz built on the same flip card as the flashcards — flip is the interaction
 * pattern only. Every question, option, answer and explanation comes from the
 * live AI analysis of the uploaded PDF; there is no fallback content here.
 *
 * Answering flips the card to the reveal; the running score and streak update
 * on that flip, and the last question hands off to a summary instead of just
 * stopping.
 */
export default function QuizDeck({
  quiz,
  status,
  error,
  onGenerate,
  onRetry,
  ready,
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const questions = quiz?.questions ?? [];
  const total = questions.length;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setAnswers({});
    setFinished(false);
  }, [quiz]);

  const score = useMemo(
    () => Object.values(answers).filter((entry) => entry.correct).length,
    [answers],
  );

  /** Streak counts backwards from the most recently answered question. */
  const streak = useMemo(() => {
    let run = 0;
    for (let i = index; i >= 0; i -= 1) {
      const entry = answers[questions[i]?.id];
      if (!entry) continue;
      if (!entry.correct) break;
      run += 1;
    }
    return run;
  }, [answers, index, questions]);

  const question = questions[index];
  const answer = question ? answers[question.id] : null;

  function choose(option) {
    if (!question || answers[question.id]) return;

    const correct = option === question.correctAnswer;
    setAnswers((current) => ({
      ...current,
      [question.id]: { selected: option, correct },
    }));
    setFlipped(true);
  }

  function next() {
    if (index >= total - 1) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setFlipped(false);
  }

  function restart() {
    setIndex(0);
    setFlipped(false);
    setAnswers({});
    setFinished(false);
  }

  if (status === 'loading') {
    return (
      <div className="sb-loading">
        <div className="sb-loading__bar" />
        <span>
          Writing quiz questions from your document…
          <br />
          This one takes the longest — around 18 questions.
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <span className="sb-error__title">Couldn't generate the quiz</span>
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
          <Icon name="quiz" size={22} />
        </span>
        <span className="sb-empty__title">No quiz yet</span>
        <span className="sb-empty__hint">
          {ready
            ? 'Test yourself on this document with multiple choice and true/false questions.'
            : 'Upload a document and set your study profile first.'}
        </span>
        <HoverButton variant="accent" onClick={onGenerate} disabled={!ready}>
          Generate quiz
        </HoverButton>
      </div>
    );
  }

  if (finished) {
    const percent = Math.round((score / total) * 100);
    const missed = questions.filter((item) => answers[item.id]?.correct === false);

    return (
      <div className="quiz quiz--summary">
        <div className="quiz__result">
          <span className="quiz__result-label">Quiz complete</span>
          <p className="quiz__result-score">
            {score}
            <span className="quiz__result-total">/ {total}</span>
          </p>
          <p className="quiz__result-percent">{percent}% correct</p>

          {quiz.summary?.encouragement ? (
            <p className="quiz__encouragement">{quiz.summary.encouragement}</p>
          ) : null}

          {quiz.summary?.weakAreaHints?.length > 0 ? (
            <div className="quiz__weak">
              <span className="sb-label">Worth revisiting</span>
              <ul>
                {quiz.summary.weakAreaHints.map((hint, hintIndex) => (
                  <li key={hintIndex}>{hint}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {missed.length > 0 ? (
            <div className="quiz__weak">
              <span className="sb-label">Questions you missed</span>
              <ul>
                {missed.map((item) => (
                  <li key={item.id}>{item.question}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="quiz__result-actions">
            <HoverButton variant="accent" onClick={restart}>
              Retake quiz
            </HoverButton>
            <HoverButton variant="ghost" size="sm" onClick={onGenerate}>
              New questions
            </HoverButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz__status">
        <div className="quiz__progress">
          <span className="quiz__progress-label">
            Question {index + 1} of {total}
          </span>
          <div className="quiz__progress-track">
            <div
              className="quiz__progress-fill"
              style={{ width: `${((index + (answer ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="quiz__scores">
          <span className="quiz__score">
            {score} <span className="quiz__score-unit">correct</span>
          </span>
          {streak >= 2 ? (
            <span className="quiz__streak">🔥 {streak} in a row</span>
          ) : null}
        </div>
      </div>

      <Flashcard
        flipped={flipped}
        interactive={false}
        tone={answer ? (answer.correct ? 'correct' : 'incorrect') : 'neutral'}
        celebrate={Boolean(answer?.correct && flipped)}
        frontLabel={
          question.type === 'true_false' ? 'True or false' : 'Multiple choice'
        }
        backLabel={answer?.correct ? 'Correct' : 'Answer'}
        front={
          <>
            <p className="quiz__question">{question.question}</p>
            <div
              className={`quiz__options${
                question.type === 'true_false' ? ' quiz__options--tf' : ''
              }`}
            >
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="quiz__option"
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        }
        back={
          <>
            <p
              className={`quiz__verdict${
                answer?.correct
                  ? ' quiz__verdict--correct'
                  : ' quiz__verdict--incorrect'
              }`}
            >
              {question.reaction ??
                (answer?.correct ? 'Correct!' : 'Not quite.')}
            </p>

            {!answer?.correct ? (
              <p className="quiz__correction">
                <span className="quiz__correction-label">Correct answer:</span>{' '}
                {question.correctAnswer}
              </p>
            ) : null}

            {question.explanation ? (
              <p className="quiz__explanation">{question.explanation}</p>
            ) : null}

            {question.source ? (
              <p className="quiz__source">From: {question.source}</p>
            ) : null}

            <div className="quiz__next">
              <HoverButton variant="accent" size="sm" onClick={next}>
                {index >= total - 1 ? 'See results' : 'Next question'}
              </HoverButton>
            </div>
          </>
        }
      />

      {quiz.note ? <p className="quiz__note">{quiz.note}</p> : null}
    </div>
  );
}
