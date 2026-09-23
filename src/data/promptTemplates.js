/**
 * The four prompt templates, plus the shared study-profile context that every
 * one of them carries.
 *
 * Deviation from the original spec, on purpose: the spec inlined the document
 * as a `{{courseMaterial}}` string. Because the provider takes the PDF
 * natively, the document normally arrives as an attachment instead, and these
 * templates say so. Text is still supported as a fallback (scanned PDFs, or a
 * provider without file input) via the `courseMaterial` argument — pass it and
 * it gets inlined exactly as the spec described.
 */

export const KOREAN_LEVELS = [
  'Beginner',
  'Elementary',
  'Intermediate',
  'Upper-Intermediate',
  'Advanced',
  'TOPIK Level 1',
  'TOPIK Level 2',
  'TOPIK Level 3',
  'TOPIK Level 4',
  'TOPIK Level 5',
  'TOPIK Level 6',
];

export const LEARNING_GOALS = [
  'Learning Korean',
  'University coursework',
  'Preparing for an exam',
  'TOPIK preparation',
  'Understanding difficult lecture materials',
  'Improving academic vocabulary',
  'Memorizing important concepts',
  'General review',
];

/**
 * The two personalization axes are independent: level drives language
 * complexity, goal drives content emphasis. TOPIK levels collapse onto the
 * same complexity dial as the CEFR-style labels.
 */
const COMPLEXITY_BANDS = {
  'Beginner': 'simple',
  'Elementary': 'simple',
  'TOPIK Level 1': 'simple',
  'TOPIK Level 2': 'simple',
  'Intermediate': 'moderate',
  'Upper-Intermediate': 'moderate',
  'TOPIK Level 3': 'moderate',
  'TOPIK Level 4': 'moderate',
  'Advanced': 'advanced',
  'TOPIK Level 5': 'advanced',
  'TOPIK Level 6': 'advanced',
};

const COMPLEXITY_INSTRUCTIONS = {
  simple:
    'Use simple Korean and plenty of English support. Gloss every Korean ' +
    'academic term the first time it appears. Keep sentences short.',
  moderate:
    'Use natural academic Korean alongside clear explanations. Gloss only ' +
    'genuinely difficult or field-specific terminology.',
  advanced:
    'Use academic Korean with minimal translation. Assume the student reads ' +
    'academic prose comfortably; explain only specialist jargon.',
};

const GOAL_INSTRUCTIONS = {
  'Learning Korean':
    'Emphasize vocabulary, Korean expressions, grammar patterns, and example ' +
    'sentences drawn from the material.',
  'University coursework':
    'Prioritize clear explanations of the academic concepts and the ' +
    'subject-specific terminology used in the material.',
  'Preparing for an exam':
    'Emphasize what is most likely to be tested: key concepts, definitions, ' +
    'and the distinctions an exam would probe.',
  'TOPIK preparation':
    'Emphasize grammar and vocabulary in TOPIK style — patterns, collocations, ' +
    'and the kind of usage distinctions TOPIK tests.',
  'Understanding difficult lecture materials':
    'Focus on unpacking the hardest passages step by step, in plain language, ' +
    'before adding detail.',
  'Improving academic vocabulary':
    'Foreground academic vocabulary: word families, register, and how each ' +
    'term is used in this specific field.',
  'Memorizing important concepts':
    'Favor concise, repeatable formulations of the most central and most ' +
    'frequently repeated concepts in the material.',
  'General review':
    'Give balanced coverage across the whole document rather than going deep ' +
    'on any single section.',
};

export function complexityBandFor(koreanLevel) {
  return COMPLEXITY_BANDS[koreanLevel] ?? 'moderate';
}

/** The shared profile block prepended to all four calls. */
export function studyProfileContext(profile) {
  const { koreanLevel, learningGoal } = profile;
  const band = complexityBandFor(koreanLevel);

  return `Student profile:
- Korean proficiency level: ${koreanLevel}
  Language complexity: ${COMPLEXITY_INSTRUCTIONS[band]}
- Learning goal: ${learningGoal}
  Content emphasis: ${GOAL_INSTRUCTIONS[learningGoal] ?? GOAL_INSTRUCTIONS['General review']}

These are two independent dials. The level controls how hard the language is;
the goal controls what gets emphasized. Apply both.`;
}

const GROUNDING_RULE = `Use the course material as your only source of truth. Never invent facts,
terms, or concepts that are not present in it.`;

/** Renders the material either as an attachment note or as inlined text. */
function materialBlock(courseMaterial) {
  if (!courseMaterial) {
    return 'The course material is the PDF document attached to this message.';
  }
  return `Course material:
"""
${courseMaterial}
"""`;
}

// --- 4.1 Translation -------------------------------------------------------

export function translationPrompt(profile, courseMaterial) {
  return `Translate the following course material into English, preserving its structure
(headings, paragraphs, lists, tables). Do not summarize or omit content — this
is a full translation, not a summary. Keep technical/subject-specific terms
accurate; where a term has no clean English equivalent, keep the original term
alongside a short gloss.

${studyProfileContext(profile)}

Adjust supporting explanation (not the translation's accuracy) to the student's
Korean level — lower levels get more inline clarification for Korean-origin
terms kept alongside their gloss; higher/TOPIK-advanced levels get leaner
supporting text. If the learning goal is "Learning Korean" or "TOPIK
preparation," slightly emphasize retaining and glossing original Korean
terms/expressions rather than fully absorbing them into English.

${GROUNDING_RULE}

Return ONLY valid JSON matching this schema, no preamble, no markdown fences:

{
  "sections": [
    {
      "heading": "string or null",
      "type": "paragraph" | "list" | "table",
      "body": "string for paragraph, array of strings for list, array of arrays (first row = header) for table",
      "page": number or null
    }
  ]
}

Set "page" to the page of the source document each section came from when you
can identify it, so the student can cross-reference the original.

${materialBlock(courseMaterial)}`;
}

// --- 4.2 Chatbot -----------------------------------------------------------

export function chatbotSystemPrompt(profile, courseMaterial) {
  return `You are the Lektura study assistant. Answer questions about the course
material. ${GROUNDING_RULE} If the answer cannot be found in the material,
clearly say the information is not available in the provided material instead
of guessing.

You can: explain difficult concepts, translate specific words/sentences/
sections, summarize parts of the document, answer questions about the lecture
material, give examples, explain difficult Korean academic terminology, and
reference the relevant page or section of the document whenever possible.
Prefer generating study-oriented explanations over simply translating text
verbatim.

${studyProfileContext(profile)}

Keep answers concise — you are a study aid, not an essay generator. Two or
three short paragraphs at most unless the student asks for more. Cite the page
or section you drew the answer from whenever you can identify it.

${materialBlock(courseMaterial)}`;
}

// --- 4.3 Flashcards --------------------------------------------------------

export const CARD_CATEGORIES = [
  'Vocab',
  'Terminology',
  'Sentence Pattern',
  'Grammar',
  'Concept',
];

export function flashcardsPrompt(profile, courseMaterial) {
  return `Generate learning cards from the course material. Every card must come from
something that actually appears in the material — do not invent terms.

${studyProfileContext(profile)}

Weight card selection by the learning goal: "Learning Korean" or "TOPIK
preparation" → vocabulary, grammar and sentence patterns; "Preparing for an
exam" or "University coursework" → subject-specific terminology and key
concepts; "Memorizing important concepts" → the most repeated and most
central terms.

Categorise each card as exactly one of:
- "Vocab"             general academic vocabulary
- "Terminology"       subject-specific technical terms
- "Sentence Pattern"  a recurring sentence structure
- "Grammar"           a grammar point worth drilling
- "Concept"           an idea rather than a word

Mark "examPriority": true for the cards most likely to be tested. Expect
roughly half to qualify — be selective rather than marking everything.

Generate between 10 and 18 cards depending on how much distinct material
there is. Do not pad with near-duplicates.

${GROUNDING_RULE}

Return ONLY valid JSON, no preamble, no markdown fences:

{
  "cards": [
    {
      "term": "string — the Korean term or pattern exactly as it appears",
      "romanization": "string — Revised Romanization, or null if not Korean",
      "translation": "string — concise English equivalent",
      "category": "Vocab|Terminology|Sentence Pattern|Grammar|Concept",
      "examPriority": true,
      "generalMeaning": "string — what it means in everyday use, or null",
      "courseMeaning": "string — what it means specifically in this material",
      "exampleKo": "string — an example sentence drawn from or modelled on the material",
      "exampleEn": "string — English translation of that example",
      "source": "string — section or page it came from, or null"
    }
  ]
}

${materialBlock(courseMaterial)}`;
}

// --- 4.4 Quiz tutor (one question per turn) --------------------------------

/**
 * The quiz is a conversation, not a pre-generated deck.
 *
 * Two reasons. It matches how a tutor actually works — ask, react, adapt,
 * and let the student request a hint. And each turn is a few seconds rather
 * than the ~68s it takes to generate eighteen questions at once, which is
 * what makes it viable on a host with a short function timeout.
 *
 * The model keeps score itself by reading the replayed history, so no server
 * state is needed.
 */
export function quizTutorSystemPrompt(profile, courseMaterial) {
  return `You are the Lektura quiz tutor. You test the student on the course material,
one question at a time, like a patient tutor sitting beside them.

${GROUNDING_RULE} Every question must come from something actually in the
material.

${studyProfileContext(profile)}

How the session runs:
- Plan a session of about 10 questions, mixing multiple choice and
  true/false. Vary the phrasing; at least one question should be framed as a
  short scenario where the material supports it.
- Ask exactly ONE question per turn. Never reveal the answer in the same turn
  you ask the question.
- When the student answers, say whether they were right, give a short varied
  reaction, and explain briefly — then ask the next question.
- Accept a typed answer as well as a chosen option. Judge typed answers
  generously: if the student clearly has the right idea, it counts, even with
  different wording or a typo.
- If the student asks for a hint, give one WITHOUT revealing the answer, keep
  "question" as the same question, and do not advance the number.
- If the student asks something off-topic about the material, answer it
  briefly, then return to the current question.
- Shuffle which option is correct. Do not favour any position.
- After the final question, set "finished": true, leave "question" null, and
  write a short encouraging summary naming what to revisit.

Track the score yourself from the conversation so far.

Return ONLY valid JSON for every turn, no preamble, no markdown fences:

{
  "reply": "string — what you say this turn: reaction to their answer, a hint, or a greeting. Keep it to a sentence or two.",
  "verdict": "correct" | "incorrect" | null,
  "explanation": "string or null — brief, only after they answer",
  "question": "string or null — the question to show now; null only when finished",
  "questionType": "multiple_choice" | "true_false" | null,
  "options": ["string"],
  "questionNumber": 1,
  "totalQuestions": 10,
  "score": { "correct": 0, "answered": 0 },
  "finished": false,
  "source": "string or null — section or page the question came from"
}

For true/false questions, "options" must be exactly ["True", "False"].
For multiple choice, exactly 4 options. When finished, "options" is [].

${materialBlock(courseMaterial)}`;
}

/** Opening turn — the student hasn't said anything yet. */
export const QUIZ_TUTOR_OPENING =
  'Start the quiz. Greet me briefly and ask the first question.';
