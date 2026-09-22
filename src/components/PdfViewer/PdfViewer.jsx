import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import HoverButton from '../HoverButton/HoverButton.jsx';
import './PdfViewer.css';

// pdf.js needs its worker as a separate file; `?url` lets Vite hash and serve
// it without trying to bundle it into the main chunk.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.25, 1.5, 2];

/**
 * Renders the uploaded PDF one page at a time, at the original layout, with
 * explicit page navigation (prev/next plus a page jump) rather than only free
 * scroll — a student cross-referencing a translation needs to land on page 7
 * directly.
 */
export default function PdfViewer({ file, onDocumentLoad }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(3); // 1.0
  const [fitWidth, setFitWidth] = useState(true);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [pageInput, setPageInput] = useState('1');

  // --- Load the document ---------------------------------------------------
  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    setStatus('loading');
    setError(null);

    (async () => {
      try {
        // A fresh ArrayBuffer per load: pdf.js takes ownership of the buffer.
        const buffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

        if (cancelled) {
          Promise.resolve(doc.destroy()).catch(() => {});
          return;
        }

        const previous = docRef.current;
        docRef.current = doc;
        Promise.resolve(previous?.destroy()).catch(() => {});

        setPageCount(doc.numPages);
        setPageNumber(1);
        setPageInput('1');
        setStatus('ready');
        onDocumentLoad?.({ pageCount: doc.numPages });
      } catch (cause) {
        if (cancelled) return;
        console.error('[PdfViewer] failed to load document', cause);
        setStatus('error');
        setError(
          cause?.name === 'PasswordException'
            ? 'This PDF is password protected.'
            : "This file couldn't be opened as a PDF.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, onDocumentLoad]);

  // Destroy the document only when the viewer itself goes away.
  //
  // Every step is guarded: this cleanup runs during React's commit phase when
  // the user switches tabs, and anything thrown here would unmount the entire
  // app rather than just this panel. destroy() also returns a promise that
  // can reject once a render has been cancelled, so its rejection is absorbed
  // too.
  useEffect(
    () => () => {
      const task = renderTaskRef.current;
      const doc = docRef.current;
      renderTaskRef.current = null;
      docRef.current = null;

      try {
        task?.cancel();
      } catch (error) {
        console.warn('[PdfViewer] render cancel failed on unmount', error);
      }

      try {
        Promise.resolve(doc?.destroy()).catch((error) => {
          console.warn('[PdfViewer] document destroy rejected', error);
        });
      } catch (error) {
        console.warn('[PdfViewer] document destroy threw', error);
      }
    },
    [],
  );

  // --- Render the current page --------------------------------------------
  const renderPage = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || status !== 'ready') return;

    // Only one render may target a canvas at a time.
    renderTaskRef.current?.cancel();

    try {
      const page = await doc.getPage(pageNumber);

      let scale = ZOOM_STEPS[zoomIndex];
      if (fitWidth && containerRef.current) {
        const available = containerRef.current.clientWidth - 32;
        const unscaled = page.getViewport({ scale: 1 });
        if (available > 0) scale = available / unscaled.width;
      }

      const viewport = page.getViewport({ scale });

      // Render at device resolution so text stays crisp on retina screens,
      // then scale back down with CSS.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const task = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (cause) {
      // A cancelled render is expected whenever the page or zoom changes.
      if (cause?.name === 'RenderingCancelledException') return;
      console.error('[PdfViewer] failed to render page', cause);
      setError('That page could not be rendered.');
    }
  }, [pageNumber, zoomIndex, fitWidth, status]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Re-render on container resize while fitting width.
  useEffect(() => {
    if (!fitWidth || !containerRef.current) return;

    const observer = new ResizeObserver(() => renderPage());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitWidth, renderPage]);

  // --- Navigation ----------------------------------------------------------
  function goToPage(next) {
    const clamped = Math.min(Math.max(next, 1), pageCount || 1);
    setPageNumber(clamped);
    setPageInput(String(clamped));
  }

  function commitPageInput() {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(pageNumber));
      return;
    }
    goToPage(parsed);
  }

  if (!file) {
    return (
      <div className="sb-empty">
        <span className="sb-empty__icon" aria-hidden="true">
          ⬆
        </span>
        <span className="sb-empty__title">No document yet</span>
        <span className="sb-empty__hint">
          Upload a lecture PDF to see it here alongside its English translation.
        </span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="sb-loading">
        <div className="sb-loading__bar" />
        <span>Opening {file.name}…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <span className="sb-error__title">Couldn't open this PDF</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="pdf">
      <div className="pdf__toolbar">
        <HoverButton
          variant="quiet"
          icon="‹"
          title="Previous page"
          aria-label="Previous page"
          disabled={pageNumber <= 1}
          onClick={() => goToPage(pageNumber - 1)}
        />

        <div className="pdf__pager">
          <input
            className="pdf__page-input"
            type="text"
            inputMode="numeric"
            value={pageInput}
            aria-label="Page number"
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitPageInput();
            }}
          />
          <span className="pdf__page-total">of {pageCount}</span>
        </div>

        <HoverButton
          variant="quiet"
          icon="›"
          title="Next page"
          aria-label="Next page"
          disabled={pageNumber >= pageCount}
          onClick={() => goToPage(pageNumber + 1)}
        />

        <div className="pdf__spacer" />

        <HoverButton
          variant="ghost"
          size="sm"
          onClick={() => setFitWidth((value) => !value)}
          title="Toggle fit-to-width"
        >
          {fitWidth ? 'Fit width' : `${Math.round(ZOOM_STEPS[zoomIndex] * 100)}%`}
        </HoverButton>

        <HoverButton
          variant="quiet"
          icon="−"
          title="Zoom out"
          aria-label="Zoom out"
          disabled={!fitWidth && zoomIndex === 0}
          onClick={() => {
            setFitWidth(false);
            setZoomIndex((index) => Math.max(index - 1, 0));
          }}
        />
        <HoverButton
          variant="quiet"
          icon="+"
          title="Zoom in"
          aria-label="Zoom in"
          disabled={!fitWidth && zoomIndex === ZOOM_STEPS.length - 1}
          onClick={() => {
            setFitWidth(false);
            setZoomIndex((index) => Math.min(index + 1, ZOOM_STEPS.length - 1));
          }}
        />
      </div>

      <div className="pdf__stage sb-scroll" ref={containerRef}>
        <canvas className="pdf__canvas" ref={canvasRef} />
      </div>

      {error ? (
        <div className="sb-error">
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
