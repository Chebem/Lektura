# Lektura — Prototype features vs. what's built

Derived from the prototype screenshots in `REFERENCE/Features/`
("Academic Study Assistant & Quiz Tutor — Interactive Study Suite").

Last updated: 2026-09-23

---

## 1. Prototype page structure

```
┌─ HEADER ─────────────────────────────────────────────────────────────┐
│ 🎓 Academic Study Assistant & Quiz Tutor   [Interactive Study Suite] │
│    Adaptive lecture learning cards + interactive quiz tutoring       │
│                                                                      │
│ [Upload Document]  ( Dual Widget | Data Widget | Chat Widget )       │
│                                        [Copy-Ready Prompt Templates] │
└──────────────────────────────────────────────────────────────────────┘

┌─ DOCUMENT HERO (dark gradient) ──────────────────────────────────────┐
│ AI STUDIO STUDY SUITE   [10 Active Cards]                            │
│ 토론_공지용                                                           │
│ 업로드된 강의 문서 • Tailored for advanced Korean learners…           │
│                    [Upload Document]  [Inspect Prompt Templates]     │
└──────────────────────────────────────────────────────────────────────┘

┌─ STUDY PREFERENCES ──────────────────────────────────────────────────┐
│ Support Language │ Korean Level │ Exam Deadline │ Available Time     │
│                                          [✨ Generate Learning Cards] │
└──────────────────────────────────────────────────────────────────────┘

┌─ SCOPE SUMMARY (green band) ─────────────────────────────────────────┐
│ Core concepts, academic vocabulary and sentence structures from …    │
│ 💡 Prioritize calculating Price Elasticity (ε) and distinguishing …  │
└──────────────────────────────────────────────────────────────────────┘

┌─ CARD FILTERS ───────────────────────────────────────────────────────┐
│ All(10) 📚Vocab 🔬Terminology 💬Patterns 📝Grammar 💡Concepts ⭐Exam(6)│
│                                  [🔍 Filter cards…]  [grid|stack]    │
└──────────────────────────────────────────────────────────────────────┘

┌─ STUDY PROGRESS ─────────────────────────────────────────────────────┐
│ Study Progress: 0 of 10 cards mastered            ▓░░░░░░░░░░        │
└──────────────────────────────────────────────────────────────────────┘

┌─ LEARNING CARDS (2-up grid) ─────────────────────────────────────────┐
│ [📚 Academic Vocab] [⭐ Exam Priority]              🔊  🔖           │
│ 초과 수요 / 초과 공급  [chogwa suyo / chogwa gonggeup]                │
│ Shortage (Excess Demand) / Surplus (Excess Supply)                   │
│ ┌──────────────────────────────────────────────────────────────┐    │
│ │ "시장 가격이 균형가격보다 낮을 경우 초과 수요가 발생하여…"      │    │
│ │ "When the market price is lower than the equilibrium price…"  │    │
│ └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

**Chat Widget — Quiz Tutor** is a *conversation*, not a deck:

```
Quiz Tutor • 10:02
  Hi! I've reviewed the lecture material and I'm ready to quiz you. 🎯

Quiz Tutor • 10:02
  Here is your first question to test core concepts from "…":
  ─────────────────────────────────────────────
  QUESTION 1 OF 3                [Multiple Choice]
  According to the lecture, what occurs when the market price is
  lower than the equilibrium price (균형가격)?
   Ⓐ A) Excess Supply (초과 공급) occurs, causing downward pressure
   Ⓑ B) Excess Demand / Shortage (초과 수요) occurs, causing upward…
   Ⓒ C) Consumer surplus collapses to zero immediately
   Ⓓ D) Demand becomes perfectly elastic (ε = ∞)

[ Type your answer or ask the tutor for a hint / explanation…    ➤ ]
```

---

## 2. Gap analysis

### Study preferences — prototype has 4 dials, we have 2

| Field | Built? | Drives |
|---|---|---|
| Korean Proficiency Level | ✅ | language complexity |
| Learning Goal | ✅ *(ours; not in prototype)* | content emphasis |
| **Preferred Support Language** | ❌ | language of explanations (English / Korean / bilingual) |
| **Exam / Assignment Deadline** | ❌ | urgency → exam-focus weighting |
| **Available Study Time** | ❌ | how many cards / how deep |

Keep Learning Goal — it does useful work the prototype's fields don't.

### Learning cards — ours are far thinner

| Feature | Built? |
|---|---|
| Term + definition, flip | ✅ |
| **Category** (Vocab / Terminology / Sentence Patterns / Grammar / Concepts) | ❌ |
| **Exam Priority flag** | ❌ |
| **Romanization** `[chogwa suyo]` | ❌ |
| **Example sentence**, Korean + English | ⚠️ inside prose, not structured |
| **Audio / TTS** per card | ❌ |
| **Bookmark / save** | ❌ |
| **Mastery tracking** ("0 of 10 mastered") | ⚠️ we track "reviewed" only |
| **Filter by category**, with counts | ❌ |
| **Text search** across cards | ❌ |
| **Grid vs stack view** | ❌ (stack only) |

### Quiz — architecturally different

| | Prototype | Ours |
|---|---|---|
| Format | conversational tutor | flip-card deck |
| Pace | one question at a time | 18 generated up front |
| Answering | type freely, or pick | click an option |
| Help | **ask for a hint / explanation** | none |
| Feedback | tutor replies in context | back of the card |

### Layout / chrome

| Feature | Built? |
|---|---|
| Three view modes (Dual / Data / Chat) | ⚠️ we have 3 tabs, different split |
| Document hero banner | ❌ |
| **Scope Summary + study tip** | ❌ |
| Prompt-template inspector | ❌ |
| Translation panel | ✅ *(ours; not in prototype)* |
| PDF viewer | ✅ *(ours; not in prototype)* |

---

## 3. What we're implementing, in order

Ordered so that each phase is independently shippable.

### Phase 1 — Richer card data *(highest value per unit of work)*
Purely a prompt + rendering change; no architecture moves.
- Extend the flashcard schema: `category`, `examPriority`, `romanization`,
  `term`, `translation`, `exampleKo`, `exampleEn`
- Redesign the card face to the prototype's layout
- Category filter chips with live counts, plus ⭐ Exam Focus
- Text search across cards
- Mastery tracking (known / still learning) replacing "reviewed"
- Grid ↔ stack toggle

### Phase 2 — Scope Summary
- One short AI call after upload: what the document covers + one study tip
- Green band above the cards; doubles as a "document loaded" confirmation

### Phase 3 — Conversational Quiz Tutor
Replaces the flip-card quiz. **This also solves a deployment problem:**
generating 18 questions at once takes ~68s and cannot fit Netlify's 10s
function cap, whereas one question per turn is a few seconds. Making the
quiz conversational makes it *deployable*.
- Question-at-a-time over the existing chat transport
- Typed answers graded by the model, or click A/B/C/D
- "Ask for a hint" without revealing the answer
- Running score, question N of M, end-of-session summary

### Phase 4 — Two more preference dials
- Available Study Time → card count and depth
- Exam / Assignment Deadline → exam-focus weighting
- Preferred Support Language → explanation language
- All three flow into the existing `studyProfileContext()`

### Phase 5 — Polish
- Document hero banner
- Audio (TTS) per card via the Web Speech API — no service needed
- Bookmark / save cards
- Prompt-template inspector ("see what we asked the AI")

---

## 4. Deliberate differences from the prototype

Not everything in the prototype should be copied.

- **Keep the PDF viewer and translation panel.** The prototype has neither,
  and they're core to the stated product — reading the original alongside an
  English translation.
- **Keep Learning Goal.** It carries content emphasis that the prototype's
  four fields don't express.
- **"Copy-Ready Prompt Templates" is a developer tool**, not a student
  feature. Worth having as a debug view; not worth prime header space.
- **Three view modes vs. our three tabs.** Ours (Document & Translation /
  Flashcards / Quiz) map better onto the actual product. Not worth reworking
  into Dual/Data/Chat.

---

## 5. Note on the source material

Five of the six screenshots are legible; `Screenshot 2026-09-23 at
10.03.42.png` is a blank sliver and contributed nothing. The prototype
content is economics (Market Equilibrium, Price Elasticity) — the card
structure generalises, but nothing about the subject is assumed.
