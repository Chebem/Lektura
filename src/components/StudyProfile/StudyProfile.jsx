import { KOREAN_LEVELS, LEARNING_GOALS } from '../../data/promptTemplates.js';
import './StudyProfile.css';

/**
 * The two required selections, pinned above the tabs and always editable.
 *
 * Both values feed every AI call in the app, so until both are set the upload
 * control stays disabled — generating anything before then would bake the
 * wrong personalization into the results.
 */
export default function StudyProfile({ profile, onChange, locked = false }) {
  const complete = Boolean(profile.koreanLevel && profile.learningGoal);

  function update(field, value) {
    onChange({ ...profile, [field]: value || null });
  }

  return (
    <section
      className="study-profile"
      aria-label="Study profile and learning preferences"
    >
      <div className="study-profile__fields">
        <div className="study-profile__field">
          <label className="sb-label" htmlFor="korean-level">
            Korean proficiency
          </label>
          <select
            id="korean-level"
            className="sb-select"
            value={profile.koreanLevel ?? ''}
            onChange={(event) => update('koreanLevel', event.target.value)}
          >
            <option value="">Select a level…</option>
            {KOREAN_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="study-profile__field">
          <label className="sb-label" htmlFor="learning-goal">
            Learning goal
          </label>
          <select
            id="learning-goal"
            className="sb-select"
            value={profile.learningGoal ?? ''}
            onChange={(event) => update('learningGoal', event.target.value)}
          >
            <option value="">Select a goal…</option>
            {LEARNING_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p
        className={`study-profile__status${
          complete ? ' study-profile__status--ok' : ''
        }`}
        role="status"
      >
        {complete ? (
          <>
            <span aria-hidden="true">✓</span> Personalizing every translation,
            answer, card and question to this profile.
          </>
        ) : (
          'Set both to continue — they shape everything the AI produces.'
        )}
      </p>

      {locked && complete ? (
        <p className="study-profile__note">
          Changing these won't rewrite what's already generated — regenerate a
          tab to apply the new profile.
        </p>
      ) : null}
    </section>
  );
}
