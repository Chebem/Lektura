import { useRef } from 'react';
import StudyProfile from '../StudyProfile/StudyProfile.jsx';
import TabSwitcher from '../TabSwitcher/TabSwitcher.jsx';
import HoverButton from '../HoverButton/HoverButton.jsx';
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
  tabs,
  activeTab,
  onTabChange,
}) {
  const fileInputRef = useRef(null);

  return (
    <header className="app__header">
      <div className="app__bar">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            L
          </span>
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

        <HoverButton
          variant="ghost"
          size="sm"
          onClick={onToggleTheme}
          title="Toggle light and dark theme"
          aria-label="Toggle light and dark theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
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
        >
          {hasDocument ? 'Replace document' : 'Upload document'}
        </HoverButton>
      </div>

      <StudyProfile
        profile={profile}
        onChange={onProfileChange}
        locked={profileLocked}
      />

      <TabSwitcher tabs={tabs} activeId={activeTab} onChange={onTabChange} />
    </header>
  );
}
