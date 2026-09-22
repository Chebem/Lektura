# StudyBridge — PDF Study Companion (v2 Spec)

Modern web app for translating and generating study content from university course
materials. Students upload the PDFs professors post to the university portal
(lecture notes, slides, readings, assignments); the app translates, explains, and
lets them study interactively.

**This is a 4-hour MVP.** Prioritize the core loop over polish or scale.

---

## 1. Main Purpose

- Primary source material: **PDF documents** uploaded by the student (lecture
  notes, slides, readings, assignments).
- The app analyzes the PDF with AI and produces: a translation, an explanatory
  chatbot, flashcards, and a quiz.
- Positioning: **B2B — sold to schools/universities**, not marketed directly to
  individual students. See `BUSINESS_PLAN.md` for the commercial side.

---

## 2. Main Page — Study Profile + Three Tabs

### Study Profile / Learning Preferences (top of the main page)

Configured once, persisted for the session, and used as context by every AI
call in the app — translation, chatbot, flashcards, and quiz.

**1. Korean Proficiency Level** (select one)
- Beginner
- Elementary
- Intermediate
- Upper-Intermediate
- Advanced
- TOPIK Level 1
- TOPIK Level 2
- TOPIK Level 3
- TOPIK Level 4
- TOPIK Level 5
- TOPIK Level 6

This affects how the AI explains Korean terminology, translates Korean
content, and generates study materials — both the general CEFR-style levels
and the TOPIK levels map to the same complexity dial; treat TOPIK levels as
their approximate CEFR-equivalent when adjusting explanation complexity
(TOPIK 1–2 ≈ Beginner/Elementary, TOPIK 3–4 ≈ Intermediate/Upper-Intermediate,
TOPIK 5–6 ≈ Advanced).

**2. Learning Goal** (select one)
- Learning Korean
- University coursework
- Preparing for an exam
- TOPIK preparation
- Understanding difficult lecture materials
- Improving academic vocabulary
- Memorizing important concepts
- General review

This shapes what the AI emphasizes, independent of language complexity:
- **Preparing for an exam** → exam-focused summaries, questions, key concepts.
- **Learning Korean** → vocabulary explanations, Korean expressions, grammar
  explanations, example sentences.
- **University coursework** → clear explanations of academic concepts and
  terminology.
- Other goals bias content similarly (TOPIK prep → grammar/vocab drilling in
  TOPIK style; memorizing concepts → more repetition-oriented flashcards;
  general review → balanced coverage).

Both fields are required before the student can generate study content, since
every downstream feature depends on them. Store them as part of the student's
study profile and pass them into every AI prompt as context — not just at
generation time, but consistently across translation, chatbot, flashcards,
and quiz.

### Tab 1 — Document & Translation

Three panels, ideally side-by-side or stacked on mobile:

**1. Original Document**
- Render the uploaded PDF as-is.
- Scrollable through the full document, with easy page-to-page navigation
  (page controls or a page jump, not just free scroll).
- Preserve the original document layout as much as possible.

**2. English Translation**
- AI-generated translation of the document content.
- Preserve structure: headings, paragraphs, lists, tables, and key terms stay
  organized and readable — not a flat wall of translated text.
- Should read as accurate, university-level English.
- Translation style/complexity should reflect the student's Korean
  proficiency level and learning goal (e.g. a beginner-level profile keeps
  more supporting explanation alongside the translation; an advanced profile
  can be leaner).

**3. AI Study Chatbot**
- Answers questions about the uploaded document, using the document as its
  primary source.
- Capabilities:
  - Explain difficult concepts
  - Translate specific words, sentences, or sections
  - Summarize parts of the document
  - Answer questions about the lecture material
  - Give examples when useful
  - Explain difficult Korean academic terminology
  - Adjust explanation complexity according to the student's Korean
    proficiency level
  - Adapt answers according to the student's learning goal
  - Generate study-oriented explanations rather than simply translating text
  - Reference the relevant page or section of the document whenever possible
- **Must not invent information.** If the answer isn't supported by the
  document, it clearly indicates the information is not available in the
  provided material rather than guessing.

### Tab 2 — Flashcards

- AI generates flashcards from the document: term/concept on the front,
  definition/explanation on the back.
- Flip interaction (card rotates or crossfades on click/tap) — gate the
  animation on `prefers-reduced-motion` (check preference → set end state →
  return early).
- Deck should be navigable (next/previous, or swipe).

### Tab 3 — Quiz (flip-card version)

- AI generates quiz questions from the document.
- **Flip-card quiz format:** question shown on the front of a card; tapping/
  flipping reveals the answer + a short explanation on the back, styled
  consistently with the flashcard component (shared component, different data).
- Keep question types simple for the 4-hour build: multiple choice + true/false.
  Skip free-text grading entirely for MVP.
- Immediate feedback on flip: correct/incorrect + why.

---

## 3. AI Behavior Rules

- Use the uploaded PDF as the only source of truth.
- Never invent facts not present in the document.
- If a chatbot question can't be answered from the document, say so plainly.
- Keep explanations concise — study aid, not essay generator.
- Every AI call (translation, chatbot, flashcards, quiz) receives the
  student's current Study Profile (Korean Proficiency Level + Learning Goal)
  as context and adjusts both language complexity and content emphasis
  accordingly — these are the two personalization axes for the whole app.
- Structure AI output as JSON so the UI can render it predictably, e.g.:

```json
{
  "translation": { "sections": [{ "heading": "...", "body": "...", "type": "paragraph|list|table" }] },
  "flashcards": [{ "front": "...", "back": "..." }],
  "quiz": [{ "type": "multiple_choice|true_false", "question": "...", "options": [], "answer": "...", "explanation": "..." }]
}
```

---

## 4. Suggested Stack (patterns worth reusing, from scratch)

This is a fresh, empty project — no existing codebase to fork or inherit
from. The patterns below are proven habits carried over conceptually from an
earlier project, not files that already exist here:

| Layer | Choice |
|---|---|
| Build | Vite + React |
| Routing | React Router (only needed if tabs are separate routes — a single-page tab switcher is simpler and fine for MVP) |
| PDF rendering | `pdfjs-dist` or `react-pdf` |
| AI | Anthropic API (Claude) — translation, chatbot, flashcard/quiz generation |
| Styling | Plain CSS, co-located per component, `:root` custom properties + `data-theme` |
| State | React state / context — **no backend database needed for the 4-hour MVP** (see below) |

### Patterns to build in from day one
`HoverButton/`-style prop-driven components, the token block (`:root` +
`[data-theme='dark']`), the reduced-motion gating pattern, folder-per-
component-with-co-located-CSS. Build these fresh — there is no old repo to
copy them from.

### What to drop for this MVP
Cognito/DynamoDB/S3/Lambda — full auth + persistence is out of scope for a
4-hour build. Keep everything in memory / component state. If a real backend is
needed later (multi-session persistence, per-school accounts), that's a
post-MVP phase, not part of this build.

### What NOT to build (MVP)
Accounts/login, multi-user data isolation, admin dashboard, payments, complex
analytics, mobile app, vector database / RAG pipeline, push notifications.

---

## 5. Data Model (in-memory, MVP)

```
Session
├── studyProfile
│   ├── koreanLevel      one of the 11 options in Section 2
│   └── learningGoal     one of the 8 options in Section 2
├── originalPdf (file reference)
├── translation (structured sections)
├── chatHistory []
├── flashcards []
└── quiz []
```

`studyProfile` is set once at the top of the page and read by every AI call
below it. No persistence required for MVP — a page refresh can safely reset
the session.

---

## 6. UI Structure

- **Study Profile bar** — Korean Proficiency Level selector + Learning Goal
  selector, pinned above the tabs, always visible/editable
- **Top-level tab switcher** — Document & Translation / Flashcards / Quiz
- **Document & Translation tab** — split-pane: original PDF | translation | chatbot (chatbot can be a collapsible floating panel that persists across tab switches if useful)
- **Flashcards tab** — card deck, flip-on-click, prev/next
- **Quiz tab** — same flip-card component, quiz data, immediate feedback on flip

Design direction: modern, clean, readable, no AWS-dashboard feel. Since this is aimed at schools evaluating the product, the UI should look credible/professional, not like a hackathon demo.

---

## 7. Development Plan (4-hour MVP)

Starting from an empty project — no existing codebase to inspect first.

1. **Phase 1 — Scaffold** the Vite + React project and the three-tab shell with mock data (fake translation, fake flashcards, fake quiz) to validate the full click-through.
2. **Phase 2 — PDF upload + render** (Tab 1, panel 1).
3. **Phase 3 — Wire the AI call** for translation (Tab 1, panel 2) — start with one hardcoded PDF to iterate fast.
4. **Phase 4 — Chatbot** wired to the same document context.
5. **Phase 5 — Flashcards** generation + flip UI.
6. **Phase 6 — Quiz** generation + flip-card quiz UI + feedback.
7. **Phase 7 — Polish pass** (only if time remains): loading states, error states, responsive check.

**If time runs short, protect this path first:**
Upload PDF → render original → generate translation → chatbot answers from document → flashcards → quiz. Everything else (theming polish, animations, routing) is secondary.

---

## 8. First Task

Before writing code:
1. Confirm the project is empty and scaffold it from scratch (Vite + React).
2. Set up PDF rendering and confirm a real PDF displays correctly before wiring any AI calls.
3. Report back framework/dependency choices before building the AI integration.