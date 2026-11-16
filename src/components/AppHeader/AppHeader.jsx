import { useRef } from 'react';
import ProfileChip from '../ProfileChip/ProfileChip.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
import Icon from '../Icon/Icon.jsx';
import './AppHeader.css';

/**
 * The pinned header: brand, current document, theme toggle, upload control,
 * the study profile, and the tab switcher.
 *
 * Presentational — it owns no session state. The file input lives here only
 * because the upload button triggers it; the chosen file is handed straight
 * back to App.
 */
export default function AppHeader({
  documentName,
  pageCount,
  profile,
  onProfileChange,
  profileComplete,
  profileLocked,
  hasDocument,
  uploading,
  onFileChosen,
  theme,
  onToggleTheme,
  onHome,
  children,
}) {
  const fileInputRef = useRef(null);

  return (
    <header className="app__header">
      <div className="app__bar">
        <div className="app__brand">
          <button
            type="button"
            className="app__home"
            onClick={onHome}
            title="Back to the upload page"
            aria-label="Lektura home"
          >
            <img src="/lektura-logo.png" alt="" className="app__logo" />
          </button>
          <div>
            <div className="app__title">Lektura</div>
            <div className="app__subtitle">
              {documentName
                ? `${documentName}${pageCount ? ` · ${pageCount} pages` : ''}`
                : 'Translate and study your course documents'}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={onFileChosen}
        />

        <ProfileChip
          profile={profile}
          onChange={onProfileChange}
          locked={profileLocked}
        />

        <HoverButton
          variant="quiet"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </HoverButton>

        <HoverButton
          variant="accent"
          size="sm"
          busy={uploading}
          disabled={!profileComplete}
          title={
            profileComplete
              ? 'Upload a course document'
              : 'Set your study profile first'
          }
          onClick={() => fileInputRef.current?.click()}
          icon={<Icon name="upload" size={16} />}
        >
          {hasDocument ? 'Replace document' : 'Upload document'}
        </HoverButton>
      </div>

      {children}
    </header>
  );
}
