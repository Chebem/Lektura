# Lektura — Planning

Living design document. Records what the app is, how it's built, and *why*
the non-obvious decisions were made, so the reasoning survives past the
session that produced it.

Last updated: 2026-09-23

---

## 1. Product

Students upload the course material professors post to the university portal
— lecture notes, slides, readings — and Lektura translates it, explains it,
and turns it into study material.

- **Source material:** Korean university course documents.
- **Output:** English translation, a chatbot grounded in the document,
  flashcards, and a quiz.
- **Positioning:** B2B — sold to schools and universities, not marketed
  directly to individual students.

Built as a 4-hour MVP. Core loop over polish.

## 2. The two personalization axes

Everything the AI produces is shaped by a **Study Profile** set once at the
top of the page and passed into *every* AI call. These are deliberately
independent dials, not one combined setting:

| Axis | Options | Controls |
|---|---|---|
| Korean proficiency | 11 (Beginner → Advanced, TOPIK 1–6) | language complexity |
| Learning goal | 8 (exam prep, TOPIK, coursework, …) | content emphasis |

TOPIK levels collapse onto the same complexity band as the CEFR-style labels
(1–2 ≈ Beginner/Elementary, 3–4 ≈ Intermediate/Upper-Intermediate,
5–6 ≈ Advanced). Both fields are required before upload is enabled —
generating anything earlier would bake in the wrong personalization.

## 3. Stack

| Layer | Choice |
|---|---|
| Build | Vite 8 + React 19 |
| PDF display | `pdfjs-dist` (client-side) |
| AI | Google Gemini (free tier) behind a provider adapter |
| Styling | Plain CSS, folder-per-component, custom-property tokens |
| State | React state only — no database, no auth |
| Host | Netlify (`lektura.netlify.app`) |

No router: a single page with a tab switcher is simpler and sufficient.

## 4. Architecture

### The key never reaches the browser

`GEMINI_API_KEY` has **no `VITE_` prefix**, so Vite refuses to inline it into
the client bundle. In production it comes from Netlify's environment
variables. Nothing in `src/` ever sees a key.

### One set of handlers, two adapters

```
server/handlers.js          ← all real behaviour lives here
   ├── server/aiProxy.js            Vite middleware   (npm run dev)
   └── netlify/functions/*.mjs      serverless        (deployed)
```

Dev and production share the handlers so they cannot drift apart. The
adapters only translate HTTP plumbing.

### Document upload

```
browser ──POST /api/documents (base64)──▶ server uploads to the Files API
                                           and returns { uri, mimeType }
browser ──POST /api/ai───────────────────▶ server generates, citing the URI
```

The document is uploaded once and referenced by URI afterwards, so chat turns
carry a reference rather than megabytes.

An earlier design had the browser upload **directly** to the provider, to
dodge serverless request-body limits. It does not work: the provider's upload
endpoint passes CORS preflight, but its actual response carries no
`Access-Control-Allow-Origin` header, so the browser cannot read the result
and `fetch()` rejects. Preflight success is not sufficient.

**Known limit:** because bytes now pass through the server, deployed uploads
are bounded by the host's request-body cap (~6MB on Netlify), i.e. roughly
4MB of file before base64 expansion. Local dev has no such limit. Chunked
forwarding is the fix; see `TASK.md`.

### Provider adapter

`server/providers/` exposes one interface (`startUpload`, `generate`), so the
provider is a one-line `.env` change. Gemini and Anthropic are implemented.

## 5. Decisions and why

| Decision | Reason |
|---|---|
| **Gemini, not Anthropic** | No free tier on Anthropic, and the user had no key. Gemini is free with no card. |
| **Native PDF input** | Gemini reads PDFs directly. Extracting text from Korean lecture slides with pdf.js frequently returns garbled or out-of-order text; letting the model read the real PDF avoids that failure mode. pdf.js is still used to *display* the document. |
| **Office files → text** | Gemini has no native Word/PowerPoint support, so those must be extracted client-side and uploaded as `text/plain`. The prompt templates already accept text as an alternative to an attachment. |
| **Files API over inline bytes** | Survives serverless body limits, keeps chat turns small, and fixed a dev bug where restarting the server lost the document. |
| **Retry on 429/503** | The free tier returns "high demand" often enough that a single attempt makes long generations look broken. 3 attempts, exponential backoff. |
| **Error boundary around tabs** | Any component fault previously blanked the entire app with no message. A panel-level boundary shows the error and keeps other tabs alive. |
| **Design system from `REFERENCE/`** | Reused the existing Chillax + lavender system rather than inventing one. A Korean fallback stack is appended because Chillax has no Hangul. |

## 6. Constraints (measured, not assumed)

| Limit | Value | Consequence |
|---|---|---|
| Netlify sync function | **10s wall clock** | Only chat fits. Blocks deployment of the rest. |
| Netlify function body | ~6MB | Why uploads bypass the server entirely. |
| Gemini free tier | ~10–15 req/min, ~250/day | Fine for study and demos. |
| Gemini Files API | ~48h expiry | Longer than a session; a refresh re-uploads. |

Measured generation times (53-page Korean lecture PDF):

| Call | Time |
|---|---|
| Chat | ~7s |
| Flashcards | ~25–34s |
| Quiz (18 questions) | ~68s |
| Full translation | **~268s** |

Translation is inherently long because it is a complete translation, not a
summary.

## 7. Data model (in memory)

```
Session
├── studyProfile { koreanLevel, learningGoal }
├── source        { kind: 'file' | 'inline', file: { uri, mimeType } }
├── translation   { sections[] }
├── chatMessages  []
├── flashcards    { cards[] }
└── quiz          { questions[], summary }
```

No persistence. A refresh resets the session, by design.

## 8. Out of scope

Accounts, multi-user isolation, admin dashboard, payments, analytics, mobile
app, RAG/vector database, OCR for scanned PDFs, free-text quiz grading.

## 9. Open question

**How to run generations longer than 10s in production.** Three candidates,
detailed in `TASK.md` → "Deployment: long-running calls". Undecided; this is
the single thing blocking a functional deployed site.

## 10. Commercial note

Gemini's **free tier may use submitted content to improve Google's products**.
Acceptable for demos; a school deployment handling real course material
should use the paid tier, where content is not used for training.
