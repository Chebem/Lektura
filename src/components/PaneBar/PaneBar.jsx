import Icon from '../Icon/Icon.jsx';
import './PaneBar.css';

export const PANES = [
  { id: 'document', label: 'Document', icon: 'document' },
  { id: 'translation', label: 'Translation', icon: 'view' },
  { id: 'cards', label: 'Cards', icon: 'cards' },
  { id: 'tutor', label: 'Tutor', icon: 'quiz' },
];

/**
 * Chooses what's on screen and how much of it.
 *
 * Single shows one pane; dual shows two side by side — read the original
 * next to its translation, or study cards while being quizzed on them.
 * Picking a third pane in dual mode replaces the one you didn't just touch,
 * so the click always does something predictable.
 */
export default function PaneBar({ layout, onLayoutChange, active, onSelect }) {
  return (
    <div className="panebar">
      <div className="panebar__layout" role="group" aria-label="Layout">
        <button
          type="button"
          className={`panebar__layout-btn${layout === 'single' ? ' panebar__layout-btn--active' : ''}`}
          onClick={() => onLayoutChange('single')}
          aria-pressed={layout === 'single'}
          title="Single pane"
        >
          <Icon name="stack" size={14} /> Single
        </button>
        <button
          type="button"
          className={`panebar__layout-btn${layout === 'dual' ? ' panebar__layout-btn--active' : ''}`}
          onClick={() => onLayoutChange('dual')}
          aria-pressed={layout === 'dual'}
          title="Two panes side by side"
        >
          <Icon name="grid" size={14} /> Dual
        </button>
      </div>

      <div className="panebar__panes" role="group" aria-label="Visible panes">
        {PANES.map((pane) => {
          const on = active.includes(pane.id);
          const position = active.indexOf(pane.id);
          return (
            <button
              key={pane.id}
              type="button"
              className={`panebar__pane${on ? ' panebar__pane--on' : ''}`}
              onClick={() => onSelect(pane.id)}
              aria-pressed={on}
            >
              <Icon name={pane.icon} size={14} />
              {pane.label}
              {on && layout === 'dual' ? (
                <span className="panebar__slot">{position + 1}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
