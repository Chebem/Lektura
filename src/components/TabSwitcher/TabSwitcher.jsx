import './TabSwitcher.css';

/**
 * Top-level tab switcher. Roving-tabindex keyboard support (arrow keys move
 * between tabs) because this is the app's primary navigation.
 */
export default function TabSwitcher({ tabs, activeId, onChange }) {
  function handleKeyDown(event) {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    onChange(tabs[nextIndex].id);
  }

  return (
    <div className="tabs" role="tablist" aria-label="Study tools" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className={`tabs__tab${active ? ' tabs__tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tabs__label">{tab.label}</span>
            {tab.badge ? <span className="tabs__badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
