# BUILD PROMPT — Paste this into Claude Code to build the full MVP in one pass

You are building **StudyBridge**, a study companion web app for university
students studying course materials. This is a 4-hour MVP. Build the entire
thing now, end to end, in one continuous session — do not stop between phases
to ask for approval. Only pause if you hit a genuine blocker (a missing API
key, a broken dependency) that you cannot resolve yourself.

---

## 0. Starting point

This is a **fresh, empty project** — no existing app code, just this
`BUILD_PROMPT.md` and `CLAUDE.md` sitting in the repo. Scaffold everything
from scratch: run the Vite + React setup yourself, create the folder
structure in Section 2, and don't assume any existing components, styles, or
config are already in place.

The patterns below are carried over conceptually from an earlier project
(not present in this repo) and are being reused here as proven habits, not
because there's existing code to inherit:
- Folder-per-component with co-located CSS (`ComponentName/ComponentName.jsx`
    + `ComponentName.css`)
- `:root` custom properties + `[data-theme='dark']` for theming
- The reduced-motion gating pattern:
  ```js
  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) { /* set end state */ return; }
  ```
- Public-folder assets referenced by absolute path, no bundler involvement,
  for any static images/icons.

Skip any step in this spec that references "the old structure," "the fork,"
or existing dead code to strip — there is none here. Just build the app as
specified below, from an empty directory.

---

## 1. Stack

- **Build:** Vite + React (functional components, hooks)
- **PDF rendering:** `pdfjs-dist` (or `react-pdf` if it's already a
  dependency) — render the original uploaded PDF in-browser, scrollable,
  preserving layout
- **AI:** Anthropic API (Claude) for translation, chatbot, flashcard
  generation, and quiz generation — one client module, reused by all four
  features
- **Styling:** plain CSS, co-located per component, custom-property tokens
- **State:** React state/context only. **No backend, no database, no auth for
  this MVP.** Everything lives in memory for the session; a refresh resetting
  the session is acceptable.
- **Routing:** not required — a single page with a tab switcher is simpler and
  sufficient. Only add React Router if you decide separate URLs are worth the
  extra complexity; default to not using it.

---

## 2. File structure to create

```
src/
├── main.jsx
├── App.jsx                        top-level tab switcher + persistent chatbot slot
├── styles/
│   ├── tokens.css                 :root + [data-theme='dark']
│   ├── index.css                  reset + base typography
│   └── layout.css
├── lib/
│   └── aiClient.js                single module wrapping all Claude API calls
├── data/
│   └── promptTemplates.js         the four prompt templates below, as exported strings/functions
├── components/
│   ├── HoverButton/
│   ├── StudyProfile/              Korean level + learning goal selectors, pinned above tabs
│   ├── TabSwitcher/
│   ├── PdfViewer/                 renders the uploaded PDF, with page navigation
│   ├── TranslationPanel/          renders structured translation JSON
│   ├── ChatbotPanel/              chat UI, floating/collapsible, persists across tabs
│   ├── FlashcardDeck/
│   │   ├── FlashcardDeck.jsx
│   │   └── Flashcard.jsx          shared flip-card component
│   └── QuizDeck/
│       └── QuizDeck.jsx           reuses Flashcard's flip mechanics, quiz data + feedback
└── pages/                         optional — skip if not using routing
```

---

## 3. Feature specs

### 3.0 Study Profile (top of page, above all tabs)

`StudyProfile` collects two required selections before any generation happens:

- **Korean Proficiency Level** — one of: Beginner, Elementary, Intermediate,
  Upper-Intermediate, Advanced, TOPIK Level 1–6 (11 options total).
- **Learning Goal** — one of: Learning Korean, University coursework,
  Preparing for an exam, TOPIK preparation, Understanding difficult lecture
  materials, Improving academic vocabulary, Memorizing important concepts,
  General review.

Both values live in top-level session state and are passed into every AI
call (translation, chatbot, flashcards, quiz) as context. Treat TOPIK levels
1–2 / 3–4 / 5–6 as roughly equivalent to Beginner-Elementary /
Intermediate-Upper-Intermediate / Advanced for complexity purposes. Disable
or prompt for these two fields before allowing document upload/generation,
since every feature downstream depends on them.

### 3.1 Tab 1 — Document & Translation

Three panels (side-by-side on desktop, stacked on mobile):

1. **Original Document** — `PdfViewer` renders the uploaded PDF, scrollable,
   with page-to-page navigation controls (not just free scroll), original
   layout preserved.
2. **English Translation** — `TranslationPanel` renders the AI's structured
   JSON output (headings, paragraphs, lists, tables kept distinguishable, not
   flattened into one text block), with complexity/style adjusted to the
   current Study Profile.
3. **AI Study Chatbot** — `ChatbotPanel`, grounded only in the uploaded
   document. Must be able to: explain concepts, translate words/sentences/
   sections, summarize parts of the document, answer questions, give
   examples, explain difficult Korean academic terminology, adjust
   explanation complexity to the Korean Proficiency Level, adapt answers to
   the Learning Goal, generate study-oriented explanations (not just literal
   translation), and reference the relevant page/section of the document
   whenever possible. If the answer isn't in the document, it must clearly
   say the information isn't available in the material rather than guessing.

### 3.2 Tab 2 — Flashcards

`FlashcardDeck` generates cards from the document (term/concept front,
definition/explanation back). Flip on click/tap, gated on reduced-motion.
Next/previous navigation through the deck.

### 3.3 Tab 3 — Quiz (flip-card format)

**Important distinction:** flip-card is the *interaction pattern only* — how
the question and answer are presented in the UI. It is not a content source.
The actual questions, options, correct answers, and explanations must always
come from the AI's analysis of the uploaded document (via the quiz generation
prompt in section 4.4), never hardcoded, never generic, never reused across
different uploads. Every quiz is specific to the document that generated it.

`QuizDeck` reuses the `Flashcard` flip component purely for its flip mechanics
— rendering the question on the front and, on flip, the reaction line +
correct/incorrect state + short explanation on the back. The data it renders
is the live AI-generated quiz JSON, not flashcard data. Multiple choice +
true/false only for this MVP — skip free-text grading entirely.

To make the quiz feel like a quiz game rather than a form:
- Show a **progress indicator** ("Question 7 of 18") above the card.
- Show a **running score/streak counter** that updates as each card is
  flipped and answered (e.g. "🔥 2 in a row" or a simple score tally).
- Add a small scale/bounce flourish on the card when a correct answer is
  revealed — gated on `prefers-reduced-motion` like every other animation in
  this app (check → set end state → return early if reduced motion).
- After the last question, show an **end-of-quiz summary** instead of just
  stopping: final score, the AI's `summary.encouragement` line, and — if the
  weak-areas feature exists in this build — which concepts to revisit.

Mock data used during Phase 2 of the build (section 6) is a placeholder for
UI wiring only — it must be fully replaced by the real `getQuiz()` call before
the build is considered done. Do not ship with mock quiz content in place.

---

## 4. AI prompt templates (put these in `data/promptTemplates.js`)

Use one shared system context across all four calls: the uploaded document
text, student preferences, and a strict "don't invent information" rule.

### Shared study profile object

```js
{
  koreanLevel,   // one of: "Beginner" | "Elementary" | "Intermediate" |
                 // "Upper-Intermediate" | "Advanced" | "TOPIK 1" | "TOPIK 2" |
                 // "TOPIK 3" | "TOPIK 4" | "TOPIK 5" | "TOPIK 6"
  learningGoal,  // one of: "Learning Korean" | "University coursework" |
                 // "Preparing for an exam" | "TOPIK preparation" |
                 // "Understanding difficult lecture materials" |
                 // "Improving academic vocabulary" |
                 // "Memorizing important concepts" | "General review"
}
```

Every prompt below maps `koreanLevel` to a complexity instruction (TOPIK 1-2 ≈
Beginner/Elementary, TOPIK 3-4 ≈ Intermediate/Upper-Intermediate, TOPIK 5-6 ≈
Advanced) and maps `learningGoal` to a content-emphasis instruction — these are
two independent dials, not one combined setting.

### 4.1 Translation prompt
```
Translate the following course material into English, preserving its structure
(headings, paragraphs, lists, tables). Do not summarize or omit content — this
is a full translation, not a summary. Keep technical/subject-specific terms
accurate; where a term has no clean English equivalent, keep the original term
alongside a short gloss.

Student profile:
- Korean proficiency level: {{koreanLevel}}
- Learning goal: {{learningGoal}}

Adjust supporting explanation (not the translation's accuracy) to the
student's Korean level — lower levels get more inline clarification for
Korean-origin terms kept alongside their gloss; higher/TOPIK-advanced levels
get leaner supporting text. If the learning goal is "Learning Korean" or
"TOPIK preparation," slightly emphasize retaining and glossing original
Korean terms/expressions rather than fully absorbing them into English.

Return ONLY valid JSON matching this schema, no preamble, no markdown fences:

{
  "sections": [
    { "heading": "string or null", "type": "paragraph|list|table", "body": "string or array" }
  ]
}

Course material:
"""
{{courseMaterial}}
"""
```

### 4.2 Chatbot system prompt
```
You are the StudyBridge study assistant. Answer questions about the course
material below. Use it as your only source of truth — do not invent
information that isn't supported by the document. If the answer cannot be
found in the material, clearly say the information is not available in the
provided material instead of guessing.

You can: explain difficult concepts, translate specific words/sentences/
sections, summarize parts of the document, answer questions about the lecture
material, give examples, explain difficult Korean academic terminology, and
reference the relevant page or section of the document whenever possible.
Prefer generating study-oriented explanations over simply translating text
verbatim.

Student profile:
- Korean proficiency level: {{koreanLevel}}
  (Beginner/Elementary/TOPIK 1-2: simpler Korean, more English support.
  Intermediate/Upper-Intermediate/TOPIK 3-4: natural academic Korean with
  explanations. Advanced/TOPIK 5-6: academic Korean, minimal translation.)
- Learning goal: {{learningGoal}}
  (Adapt emphasis: exam prep → highlight what's likely testable; learning
  Korean or TOPIK prep → surface vocabulary/grammar/expressions more; university
  coursework → prioritize clear academic-concept explanations; memorizing
  concepts → favor concise, repeatable explanations; general review → balanced
  coverage.)

Course material:
"""
{{courseMaterial}}
"""
```

### 4.3 Flashcard generation prompt
```
Generate flashcards from the course material below. Each card should cover one
piece of difficult academic vocabulary, subject-specific terminology, a
frequently used sentence pattern, or a difficult grammar structure that
actually appears in the material — do not invent terms not present in the text.

For each card, where possible include: the term, an English translation, a
simple general meaning, the meaning as used specifically in this material, and
an example sentence drawn from or modeled closely on the course context.

Student profile:
- Korean proficiency level: {{koreanLevel}} — adjust complexity accordingly.
- Learning goal: {{learningGoal}} — if "Learning Korean" or "TOPIK
  preparation," weight card selection toward vocabulary/grammar/sentence
  patterns; if "Preparing for an exam" or "University coursework," weight
  toward subject-specific terminology and key concepts; if "Memorizing
  important concepts," favor the most repeated/central terms in the material.

Return ONLY valid JSON, no preamble, no markdown fences:

{
  "flashcards": [
    {
      "front": "string (term)",
      "back": "string (translation + simple meaning + course-specific meaning + example)"
    }
  ]
}

Course material:
"""
{{courseMaterial}}
"""
```

### 4.4 Quiz generation prompt
```
You are an academic quiz generator for StudyBridge. Generate a short quiz
based ONLY on the course material provided below. Do not invent facts,
concepts, or terminology not present in the material.

Student profile:
- Korean proficiency level: {{koreanLevel}}
- Learning goal: {{learningGoal}}

Adjust vocabulary and explanation complexity to the student's Korean level:
- Beginner/Elementary/TOPIK 1-2: simpler Korean, with English support in
  explanations.
- Intermediate/Upper-Intermediate/TOPIK 3-4: natural academic Korean, with
  explanations.
- Advanced/TOPIK 5-6: more academic Korean, minimal translation.

Adjust question emphasis to the learning goal:
- Preparing for an exam / TOPIK preparation: favor questions on likely
  test-relevant concepts and terminology.
- Learning Korean / Improving academic vocabulary: favor questions testing
  Korean terms, expressions, and sentence patterns from the material.
- University coursework / Understanding difficult lecture materials: favor
  questions on the core academic concepts.
- Memorizing important concepts / General review: favor broad, balanced
  coverage of the material's main points.

Make this feel like an engaging quiz, not a dry test:
- Vary question phrasing — at least one question can be framed as a short
  scenario or "imagine you're..." setup rather than a flat declarative
  statement, where the material supports it.
- For each question, include a short, varied "reaction" line to show on
  reveal — encouraging on correct answers, gentle and non-discouraging on
  incorrect ones (e.g. "Nailed it!", "So close — here's why", "Tricky one,
  nice try"). Do not reuse the same reaction twice in one quiz.
- Shuffle the position of the correct answer among the options for each
  multiple choice question — don't always put it in the same slot.

Generate exactly:
- 12 multiple choice questions
- 6 true/false questions

(18 total — feel free to shift a couple toward the higher end, up to 20 total,
if the material comfortably supports more distinct questions; do not pad with
repetitive or near-duplicate questions just to hit a number.)

(Short answer and concept application are in the full product spec but out of
scope for this MVP — multiple choice + true/false only.)

For every question:
- Base it directly on a specific part of the course material.
- Include a short "source" field pointing to the relevant section/topic, if
  identifiable.
- Include a concise explanation (2-3 sentences) for the correct answer,
  at the {{koreanLevel}} complexity level, weighted per the learning-goal
  guidance above.
- Multiple choice: exactly 4 options, only one correct.
- True/false: a single clear statement.

Return ONLY valid JSON, no preamble, no markdown fences:

{
  "quiz": [
    {
      "type": "multiple_choice",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string (must match one option exactly)",
      "reaction": "string (short, varied, shown on reveal)",
      "explanation": "string",
      "source": "string or null"
    },
    {
      "type": "true_false",
      "question": "string",
      "correctAnswer": true,
      "reaction": "string (short, varied, shown on reveal)",
      "explanation": "string",
      "source": "string or null"
    }
  ],
  "summary": {
    "encouragement": "string (one light closing line, written after seeing question difficulty — not generic)"
  }
}

If the material doesn't support all requested questions, generate fewer rather
than inventing content, and add a top-level "note" field explaining why.

Course material:
"""
{{courseMaterial}}
"""
```

---

## 5. `aiClient.js` requirements

- One function per feature: `getTranslation(courseMaterial)`,
  `askChatbot(courseMaterial, preferences, chatHistory, userMessage)`,
  `getFlashcards(courseMaterial, preferences)`,
  `getQuiz(courseMaterial, preferences)`.
- Each strips ```json fences from the response defensively before parsing.
- Each wraps the call in try/catch and surfaces a clear error state to the UI
  rather than crashing.
- Do not hardcode an API key in the frontend — read it from environment
  config appropriate to how this repo is set up (ask if unclear rather than
  guessing at a secrets pattern).

---

## 6. Build order (do all of this now, in sequence, without stopping for approval)

1. Set up the Vite/React project structure and global styles/tokens.
2. Build `TabSwitcher` + `App.jsx` shell with all three tabs wired to mock
   data first, so the full click-through works end to end.
3. Build `PdfViewer` and confirm a real uploaded PDF renders correctly.
4. Build `aiClient.js` and `promptTemplates.js`.
5. Wire the translation call into `TranslationPanel`, replacing mock data.
6. Wire `ChatbotPanel` to the chatbot prompt, with a persistent chat history
   for the session.
7. Wire `FlashcardDeck` to the flashcard generation call.
8. Wire `QuizDeck` to the quiz generation call, sharing the flip component
   with `FlashcardDeck`, plus correct/incorrect feedback on flip.
9. Add loading and error states across all AI-driven panels.
10. Final pass: responsive check, dark/light theme check, remove any leftover
    mock data or console logs.

**If you run low on time, protect this path first and treat everything else
as optional:** upload PDF → render original → generate translation → chatbot
answers grounded in the document → flashcards → quiz. Skip theming polish,
extra animations, or routing before you'd skip any of these six.

---

## 7. Report back

Once built, tell me:
- Any step you had to deviate from this spec on, and why.
- Anything you skipped due to time, and what it would take to add it.
- The one command to run the app locally.