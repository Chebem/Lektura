import { useRef, useState } from 'react';
import StudyProfile from '../StudyProfile/StudyProfile.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
import Icon from '../Icon/Icon.jsx';
import chatbotArt from '../../assets/ai-chatbot.svg';
import './Landing.css';

const FEATURES = [
  {
    icon: 'document',
    title: 'Side-by-side translation',
    body: 'Your original PDF next to a structured English translation, headings, lists and key terms intact.',
  },
  {
    icon: 'chat',
    title: 'A tutor that knows the lecture',
    body: 'Ask about any page. Answers come from your document only, with page references.',
  },
  {
    icon: 'cards',
    title: 'Learning cards & quizzes',
    body: 'Flip-card vocabulary and concept checks, tuned to your Korean level and goal.',
  },
];

/**
 * The upload landing page. Profile first, then the PDF — the same order the
 * workspace enforces, because every AI call needs both.
 */
export default function Landing({
  profile,
  onProfileChange,
  uploading,
  uploadError,
  onUpload,
  hasDocument,
  onResume,
  theme,
  onToggleTheme,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState(null);

  const profileComplete = Boolean(profile.koreanLevel && profile.learningGoal);
  const canUpload = profileComplete && !uploading;

  function pickFile() {
    if (canUpload) fileInputRef.current?.click();
  }

  function accept(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setDropError('That file isn’t a PDF. Lektura reads PDF course documents.');
      return;
    }
    setDropError(null);
    onUpload(file);
  }

  function onInputChange(event) {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    accept(chosen);
  }

  function onDragOver(event) {
    event.preventDefault();
    if (canUpload) setDragging(true);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (canUpload) accept(event.dataTransfer.files?.[0]);
  }

  const error = dropError ?? uploadError?.message;

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__brand">
          <img src="/lektura-logo.png" alt="" className="landing__logo" />
          <div>
            <div className="landing__name">Lektura</div>
            <div className="landing__tagline">
              AI study companion for Korean course materials
            </div>
          </div>
        </div>

        <div className="landing__nav-actions">
          {hasDocument ? (
            <HoverButton variant="ghost" size="sm" onClick={onResume}>
              Back to my document
            </HoverButton>
          ) : null}
          <HoverButton
            variant="quiet"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </HoverButton>
        </div>
      </header>

      <main className="landing__main">
        <section className="landing__hero">
          <div className="landing__copy">
            <p className="landing__eyebrow">
              <Icon name="spark" size={14} />
              Your lectures, made clear
            </p>

            <h1 className="landing__title">
              Study every lecture in a language you{' '}
              <span className="landing__title-accent">understand.</span>
            </h1>

            <p className="landing__lede">
              Upload the PDF your professor posted. Lektura translates it,
              explains it at your Korean level, and turns it into learning
              cards and quizzes using only what’s in the document.
            </p>

            <div className="landing__step">
              <span className="landing__step-num">1</span>
              <span className="landing__step-label">Your study profile</span>
            </div>
            <div className="landing__profile">
              <StudyProfile profile={profile} onChange={onProfileChange} />
            </div>

            <div className="landing__step">
              <span
                className={`landing__step-num${
                  profileComplete ? '' : ' landing__step-num--idle'
                }`}
              >
                2
              </span>
              <span className="landing__step-label">Upload a lecture PDF</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={onInputChange}
            />

            <div
              className={[
                'landing__drop',
                dragging && 'landing__drop--over',
                !profileComplete && 'landing__drop--disabled',
              ]
                .filter(Boolean)
                .join(' ')}
              role="button"
              tabIndex={canUpload ? 0 : -1}
              aria-disabled={!canUpload}
              onClick={pickFile}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pickFile();
                }
              }}
              onDragOver={onDragOver}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="landing__drop-icon">
                <Icon name="upload" size={22} />
              </span>
              <span className="landing__drop-text">
                <strong>
                  {uploading
                    ? 'Reading your document…'
                    : 'Drag & drop your lecture PDF here'}
                </strong>
                <span>
                  {profileComplete
                    ? 'Or click to browse notes, slides, readings or assignments.'
                    : 'Set your study profile above first.'}
                </span>
              </span>
              <HoverButton
                variant="accent"
                size="sm"
                busy={uploading}
                disabled={!profileComplete}
                tabIndex={-1}
                icon={<Icon name="arrow" size={14} />}
              >
                Upload PDF
              </HoverButton>
            </div>

            {error ? (
              <p className="landing__error" role="alert">
                {error}
                {!dropError && uploadError?.hint ? ` ${uploadError.hint}` : ''}
              </p>
            ) : null}

            <p className="landing__trust">
              <Icon name="known" size={14} />
              Answers come only from your document, Lektura won’t make
              things up. Files are used for this session and aren’t saved by
              Lektura.
            </p>
          </div>

          <div className="landing__art" aria-hidden="true">
            <div className="landing__art-panel">
              <div className="landing__art-bg">
                <span className="landing__orb landing__orb--a" />
                <span className="landing__orb landing__orb--b" />
              </div>
              <img src={chatbotArt} alt="" className="landing__bot" />

              <div className="landing__chip landing__chip--top">
                <span className="landing__chip-icon">
                  <Icon name="document" size={16} />
                </span>
                <span>
                  <small>Translation</small>
                  <strong>12 pages · ready</strong>
                </span>
                <span className="landing__chip-check">
                  <Icon name="known" size={12} />
                </span>
              </div>

              <div className="landing__chip landing__chip--mid">
                <span className="landing__chip-icon">
                  <Icon name="chat" size={16} />
                </span>
                <span>
                  <small>Tutor</small>
                  <strong>“See page 4 for 조사”</strong>
                </span>
              </div>

              <div className="landing__chip landing__chip--low">
                <span className="landing__chip-icon landing__chip-icon--green">
                  <Icon name="cards" size={16} />
                </span>
                <span>
                  <small>Learning cards</small>
                  <strong>24 terms · TOPIK 3</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="landing__features"
          aria-label="What Lektura does"
        >
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing__feature">
              <span className="landing__feature-icon">
                <Icon name={feature.icon} size={18} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-brand">
            <img src="/lektura-logo.png" alt="" className="landing__footer-logo" />
            <span>
              <strong>Lektura</strong> · Built for universities
            </span>
          </div>

          <nav className="landing__footer-links" aria-label="Footer">
            <a href="#features">How it works</a>
            <a
              href="https://github.com/Chebem/Lektura"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>

          <p className="landing__footer-note">
            © {new Date().getFullYear()} Lektura. AI output can contain
            mistakes, check important details against your course material.
          </p>
        </div>
      </footer>
    </div>
  );
}
