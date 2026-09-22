import './TranslationPanel.css';

/**
 * Renders the structured translation JSON.
 *
 * The point of the structure is that headings, paragraphs, lists and tables
 * stay distinguishable instead of collapsing into one wall of text — so each
 * section type gets its own renderer.
 */
export default function TranslationPanel({
  translation,
  status,
  error,
  onRetry,
}) {
  if (status === 'loading') {
    return (
      <div className="sb-loading">
        <div className="sb-loading__bar" />
        <span>
          Translating the whole document…
          <br />
          A full lecture PDF runs 2–5 minutes — it's a complete translation,
          not a summary. You can use the other tabs while it finishes.
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <span className="sb-error__title">Translation failed</span>
        <span>{error?.message}</span>
        {error?.hint ? <span>{error.hint}</span> : null}
        {onRetry ? (
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (!translation) {
    return (
      <div className="sb-empty">
        <span className="sb-empty__icon" aria-hidden="true">
          ⇄
        </span>
        <span className="sb-empty__title">No translation yet</span>
        <span className="sb-empty__hint">
          Generate one to read the document in English, with its headings,
          lists and tables kept intact.
        </span>
      </div>
    );
  }

  return (
    <div className="translation sb-scroll">
      {translation.warning ? (
        <p className="translation__warning">{translation.warning}</p>
      ) : null}

      {translation.sections.map((section, index) => (
        <section className="translation__section" key={index}>
          {section.heading ? (
            <h3 className="translation__heading">
              {section.heading}
              {section.page ? (
                <span className="translation__page">p.{section.page}</span>
              ) : null}
            </h3>
          ) : null}
          <SectionBody section={section} />
        </section>
      ))}
    </div>
  );
}

function SectionBody({ section }) {
  const { type, body } = section;

  if (type === 'list') {
    const items = Array.isArray(body) ? body : [body];
    return (
      <ul className="translation__list">
        {items.map((item, index) => (
          <li key={index}>{renderCell(item)}</li>
        ))}
      </ul>
    );
  }

  if (type === 'table') {
    const rows = Array.isArray(body) ? body.filter(Array.isArray) : [];

    // A table whose body didn't come back as rows still has to render
    // something rather than silently dropping the content.
    if (rows.length === 0) {
      return <p className="translation__paragraph">{renderCell(body)}</p>;
    }

    const [header, ...rest] = rows;

    return (
      <div className="translation__table-wrap sb-scroll">
        <table className="translation__table">
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th key={index}>{renderCell(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderCell(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // paragraph — split on blank lines so multi-paragraph bodies breathe.
  const text = typeof body === 'string' ? body : renderCell(body);
  return (
    <>
      {String(text)
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <p className="translation__paragraph" key={index}>
            {paragraph}
          </p>
        ))}
    </>
  );
}

/** Model output isn't always the declared type; coerce rather than crash. */
function renderCell(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return value.map(renderCell).join(', ');
  return JSON.stringify(value);
}
