# StudyBridge

Upload the course PDFs your professors post to the university portal — lecture
notes, slides, readings — and get an English translation, a chatbot grounded in
the document, flashcards, and a quiz. Everything is personalized to a study
profile you set once.

Built as a 4-hour MVP. No accounts, no database: the session lives in memory
and a refresh resets it, by design.

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints (http://localhost:5173, or the next free port).

An API key must be in `.env` before the AI features work:

```bash
cp .env.example .env
# then paste your key into GEMINI_API_KEY=
```

Get a free key at <https://aistudio.google.com/apikey> — no credit card. Without
a key the app still loads and the PDF viewer works; the AI panels explain
what's missing instead of failing silently.

## How the key is kept out of the browser

`GEMINI_API_KEY` deliberately has **no `VITE_` prefix**, so Vite refuses to
inline it into the client bundle. Nothing in `src/` ever sees a key:

```
browser  ──POST /api/ai──▶  Vite dev middleware  ──▶  Gemini API
                            (server/aiProxy.js,
                             attaches the key)
```

The document is uploaded **once, straight from the browser to the AI
provider**, and referenced by URI after that:

```
browser ──POST /api/documents──▶ function mints a resumable upload URL
                                  (holds the key; the URL contains no key)
browser ──────bytes────────────▶ provider's upload endpoint (direct)
browser ──POST /api/ai────────▶ function generates, citing the file URI
```

Two reasons it works this way rather than proxying the file:

- Serverless hosts cap function request bodies (Netlify ~6MB). A 5.6MB PDF
  exceeds that once base64-encoded, so proxying it would simply fail.
- Chat turns stay tiny — they send a URI, not megabytes.

Dev and production serve the *same* handlers (`server/handlers.js`) through two
thin adapters — `server/aiProxy.js` for `vite dev`, `netlify/functions/*.mjs`
for the deployed site — so the two can't drift apart.

## Deploying

The repo is Netlify-ready (`netlify.toml`): build `npm run build`, publish
`dist`, functions in `netlify/functions`.

**Set the key in the host, not in the repo.** In Netlify: Site configuration →
Environment variables → add `GEMINI_API_KEY`. `.env` is gitignored and is
never part of a deploy; `.env.example` is the committed template. Then
redeploy so the functions pick it up.

Routing note: `netlify.toml` matches `/api/*` **before** the SPA catch-all. Get
that order wrong and `/*  → /index.html` swallows the API, so every AI call
returns the HTML shell with a 404 — which is exactly how the first deploy of
this app failed.

Files uploaded to Gemini's Files API expire after about 48 hours. That's well
beyond a study session, and a refresh re-uploads, so nothing needs cleaning up.

## Switching the AI provider

Provider choice is one line in `.env`. Every provider implements the same
`generate({system, prompt, history, document, json})` interface, so nothing
above `server/providers/` knows which is running.

```bash
AI_PROVIDER=gemini     # default — free tier, no card, native PDF input
AI_PROVIDER=anthropic  # needs: npm install @anthropic-ai/sdk + billing credit
```

Gemini is the default because it is free *and* accepts the PDF natively. That
second part matters more than it sounds: extracting text from Korean lecture
slides with pdf.js frequently returns garbled or out-of-order text, and the AI
reading the real PDF avoids that failure mode entirely. pdf.js is still used to
*display* the document.

## Layout

```
server/
├── aiProxy.js            Vite middleware; the only place the key exists
├── documentStore.js      in-memory PDF store (Map, not a database)
└── providers/            gemini.js · anthropic.js — same interface
src/
├── App.jsx               session state, tabs, upload, theme
├── data/promptTemplates.js   the four prompts + shared study-profile context
├── lib/aiClient.js       every AI call; fence-stripping + defensive parsing
├── lib/useReducedMotion.js
├── styles/               tokens · fonts · base · layout
└── components/           folder-per-component with co-located CSS
    ├── StudyProfile/     Korean level + learning goal, pinned above the tabs
    ├── PdfViewer/        pdf.js render with page navigation
    ├── TranslationPanel/ renders structured translation JSON
    ├── ChatbotPanel/     chat grounded in the document
    ├── FlashcardDeck/    Flashcard.jsx is the shared flip card
    └── QuizDeck/         reuses that flip card with quiz data
```

## Design system

Palette, typeface and dark-mode values come from `REFERENCE/` — Chillax
variable font, lavender accent (`#8A4FFF` / `#6D28D9`), `#F3F2FA` ground, pill
uppercase buttons, grain overlay. `src/styles/tokens.css` keeps REFERENCE's
variable names verbatim so its CSS drops in unchanged, and adds what an app
UI needs on top (panel surfaces, semantic states, spacing, motion).

Two deliberate departures:

- **Korean fallback stack** appended to the Chillax stack. Chillax has no
  Hangul, so without it Korean course material renders as tofu boxes.
- **The grain overlay** is generated with inline SVG turbulence rather than
  REFERENCE's `/images/noise.png`, so there's no binary asset to keep in sync.
- REFERENCE's GSAP `.line-left` / `.line-top` page rules were left out — they
  suit a marketing page, not a three-panel document workspace.

## Study profile

Both fields are required before upload is enabled, because every AI call
receives them and generating anything earlier would bake in the wrong
personalization. They are two independent dials:

- **Korean proficiency** (11 options incl. TOPIK 1–6) → language complexity.
  TOPIK 1–2 ≈ Beginner/Elementary, 3–4 ≈ Intermediate/Upper-Intermediate,
  5–6 ≈ Advanced.
- **Learning goal** (8 options) → content emphasis.

## Free-tier limits

Roughly 10–15 requests/minute and ~250/day. One upload costs 3 generation
calls plus a call per chat turn, so that's ample for study and demos. The
provider retries `429`/`503` three times with exponential backoff — the free
tier returns "high demand" often enough that a single attempt makes the long
generations look broken when they aren't.

Note for the B2B pitch: **free-tier prompts may be used by Google to improve
their products.** Since real course material is involved, a school deployment
should use the paid tier, where content isn't used for training.

## Known limits

- Translating a full lecture PDF takes **2–5 minutes**. It's a complete
  translation rather than a summary, so it's inherently long; the other tabs
  stay usable while it runs.
- Scanned/image-only PDFs have no extractable structure. The AI reads them as
  images and results degrade; there's no OCR pass.
- Quiz grading is multiple choice + true/false only. Free-text answers were
  explicitly out of scope.
