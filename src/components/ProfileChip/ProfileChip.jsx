import { useEffect, useRef, useState } from 'react';
import StudyProfile from '../StudyProfile/StudyProfile.jsx';
import Icon from '../Icon/Icon.jsx';
import './ProfileChip.css';

/**
 * The study profile in compact form for the workspace header.
 *
 * The student already set both values on the landing page, so the full bar
 * would cost a row of panel height to show two answers they just gave. The
 * chip shows the current values and opens the same StudyProfile form in a
 * popover when they want to change them.
 */
export default function ProfileChip({ profile, onChange, locked }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const complete = Boolean(profile.koreanLevel && profile.learningGoal);
  const summary = complete
    ? `${profile.koreanLevel} · ${profile.learningGoal}`
    : 'Set study profile';

  return (
    <div className="profile-chip" ref={rootRef}>
      <button
        type="button"
        className={`profile-chip__button${
          complete ? '' : ' profile-chip__button--empty'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Edit study profile"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="grammar" size={14} />
        <span className="profile-chip__summary">{summary}</span>
      </button>

      {open ? (
        <div
          className="profile-chip__popover"
          role="dialog"
          aria-label="Study profile"
        >
          <StudyProfile profile={profile} onChange={onChange} locked={locked} />
        </div>
      ) : null}
    </div>
  );
}
