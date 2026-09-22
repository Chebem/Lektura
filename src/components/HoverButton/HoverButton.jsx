import './HoverButton.css';

/**
 * Prop-driven button used everywhere in the app.
 *
 * Builds on REFERENCE's `.btn` / `.btn-outline` pill so it matches the rest of
 * the design system, and adds the variants this app needs (ghost, accent) plus
 * a busy state.
 */
export default function HoverButton({
  children,
  onClick,
  variant = 'solid',
  size = 'md',
  busy = false,
  disabled = false,
  icon = null,
  title,
  type = 'button',
  className = '',
  ...rest
}) {
  const classes = [
    'btn',
    variant === 'outline' && 'btn-outline',
    'hover-btn',
    `hover-btn--${variant}`,
    size === 'sm' && 'btn-sm',
    busy && 'hover-btn--busy',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      title={title}
      {...rest}
    >
      {icon ? (
        <span className="hover-btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="hover-btn__label">{children}</span>
    </button>
  );
}
