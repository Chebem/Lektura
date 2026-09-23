# Lektura — Tasks

Working task list. See `PLANNING.md` for architecture and the reasoning
behind these choices.

Last updated: 2026-09-23

---

## 🔴 Blocking

### Deployment: long-running calls
`lektura.netlify.app` cannot run generations. Netlify kills synchronous
functions at **10s**; translation takes **~268s**, quiz ~68s, flashcards ~30s.
Only chat (~7s) fits, and only barely. **No Netlify setting raises the limit
far enough** — this needs an architectural choice:

- [ ] **Decide the approach** ← *nothing else here can proceed first*
  - **A. Background functions + polling** (recommended). A Netlify background
    function (15-min limit) generates and writes the result to Netlify Blobs;
    the browser polls for it. Keeps the current host and URL. Most work, but
    it genuinely handles 268s.
  - **B. Move to Cloudflare Workers.** Bills CPU time, not wall clock, so
    waiting on a slow AI response doesn't count. Natural fit for a proxy.
    Costs the `netlify.app` URL and an adapter rewrite.
  - **C. Ship chat only.** Everything else stays a local demo. Least work,
    leaves the site mostly non-functional.
- [ ] Implement the chosen approach
- [ ] Set `GEMINI_API_KEY` in Netlify → Site configuration → Environment
      variables (**manual, dashboard-only** — it is deliberately not in the
      repo), then redeploy
- [ ] Verify live: `/api/health` returns JSON, not the HTML shell

### Push pending
- [ ] Push commit `75d2663` (serverless API + direct upload). Git could not
      reach the macOS keychain from the agent shell:
      `git push origin main`

---

## 🟡 Next up

### Multi-format upload (docx / pptx)
Currently PDF only. All of the user's test files are modern ZIP-based Office
formats, so all are parseable. Gemini has no native Word/PowerPoint support,
so these get extracted to text in the browser and uploaded as `text/plain` —
the server and prompt templates already accept that path.

- [ ] `src/lib/extractDocument.js` — dispatch on file type
- [ ] DOCX via `mammoth` → structured text (headings, lists preserved)
- [ ] PPTX via `jszip` + parse `ppt/slides/slideN.xml` `<a:t>` runs
      (slides map naturally onto "pages")
- [ ] Text preview panel for the "Original document" pane — pdf.js only
      renders PDFs, so Office files show extracted text with slide/section
      markers so it still lines up with the translation beside it
- [ ] Accept the new types in the file input and `ACCEPTED_UPLOAD_TYPES`
- [ ] Reject legacy binary `.doc` / `.ppt` (OLE2) with a "re-save as .docx /
      .pptx / PDF" message — not parseable in-browser
- [ ] Update copy that says "the PDF you uploaded" (ChatbotPanel intro,
      empty states) now that it isn't always a PDF

### Finish the rename
`StudyBridge` → `Lektura` is partially applied (page title and chat panel
only). Remaining:
- [ ] `src/data/promptTemplates.js` — **user-visible**: the chatbot's system
      prompt says "You are the StudyBridge study assistant"
- [ ] `src/App.jsx`, `src/lib/aiClient.js`, `src/components/ChatbotPanel/`,
      `src/components/ErrorBoundary/`, `server/aiProxy.js` (comments/strings)
- [ ] `README.md`
- [ ] Fix the grammar in ChatbotPanel's intro: "the lektura will say so and
      not guess" → "Lektura will say so instead of guessing"

---

## 🟢 Backlog

- [ ] Reconsider the model. Currently `gemini-3.1-flash-lite`
      (`server/providers/gemini.js`), the weakest tier — noticeably worse
      Korean translation and quiz quality than `gemini-3.6-flash`, which is
      what the verification runs used.
- [ ] Cut the 268s translation: translate page-by-page and stream sections in
      as they finish, so the student reads page 1 while page 20 is still
      running. Also makes each call small enough for shorter timeouts.
- [ ] Scanned/image-only PDFs produce poor results — no OCR pass.
- [ ] `npm run build` warns the bundle is >500KB; pdf.js dominates. Code-split
      the viewer if load time matters.
- [ ] Persist the session (currently a refresh clears everything).
- [ ] Paid Gemini tier before any real school deployment — free-tier content
      may be used for training.

---

## ✅ Done

- [x] Vite + React scaffold, three-tab shell, design tokens from `REFERENCE/`
- [x] Study Profile (11 levels × 8 goals) gating upload, passed to every call
- [x] PDF viewer with page navigation, zoom, fit-width
- [x] Four prompt templates with shared study-profile context
- [x] Translation panel rendering structured JSON (paragraph / list / table)
- [x] Chatbot grounded in the document, cites pages, refuses to invent
- [x] Flashcard deck with flip, reduced-motion gated
- [x] Quiz reusing the flip card: 12 MC + 6 T/F, progress, streak, summary
- [x] Loading and error states across every AI panel
- [x] Retry with backoff on 429/503
- [x] **Fixed:** blank app after upload when switching tabs — PdfViewer's
      unmount cleanup threw during React's commit phase and tore down the
      whole root. Cleanup hardened, plus an ErrorBoundary so no single panel
      can blank the app again.
- [x] **Security:** API key was committed and pushed to a public repo.
      Revoked (verified dead against the API), commits removed, repo made
      private, `.env` gitignored.
- [x] Serverless API layer + direct-to-provider upload *(built and verified
      locally; blocked on the 10s limit above before it works deployed)*

---

## Verified against a real Korean lecture PDF

`TestRun/13주차_제11장 상속(S).pdf` — 53 pages:

- Translation: 54 sections, all three section types, page numbers, not truncated
- Flashcards: 12 cards — term, English, general meaning, course meaning, example
- Quiz: exactly 12 MC + 6 T/F; **12/12** correct answers match an option;
  **18/18** distinct reaction lines; correct-answer slots shuffled
- Grounding: asked for the professor's birthday → "제공된 강의 자료에는 …
  정보가 나와 있지 않습니다" rather than inventing an answer
