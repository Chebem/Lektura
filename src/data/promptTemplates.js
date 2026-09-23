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

export function flashcardsPrompt(profile, courseMaterial) {
  return `Generate flashcards from the course material. Each card should cover one piece
of difficult academic vocabulary, subject-specific terminology, a frequently
used sentence pattern, or a difficult grammar structure that actually appears
in the material — do not invent terms not present in the text.

For each card, where possible include: the term, an English translation, a
simple general meaning, the meaning as used specifically in this material, and
an example sentence drawn from or modeled closely on the course context.

${studyProfileContext(profile)}

Weight card selection by the learning goal: "Learning Korean" or "TOPIK
preparation" → vocabulary, grammar, and sentence patterns; "Preparing for an
exam" or "University coursework" → subject-specific terminology and key
concepts; "Memorizing important concepts" → the most repeated and most central
terms in the material.

Generate between 10 and 18 cards, depending on how much distinct material
there is. Do not pad with near-duplicates to hit a number.

${GROUNDING_RULE}

Return ONLY valid JSON, no preamble, no markdown fences:

{
  "flashcards": [
    {
      "front": "string (the term or pattern, as it appears in the material)",
      "back": "string (translation + simple meaning + course-specific meaning + example)",
      "source": "string or null (section or page it came from)"
    }
  ]
}

${materialBlock(courseMaterial)}`;
}

// --- 4.4 Quiz --------------------------------------------------------------

export function quizPrompt(profile, courseMaterial) {
  return `You are an academic quiz generator for StudyBridge. Generate a short quiz based
ONLY on the course material provided. Do not invent facts, concepts, or
terminology not present in the material.

${studyProfileContext(profile)}

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

(18 total — you may shift a couple toward the higher end, up to 20 total, if
the material comfortably supports more distinct questions; do not pad with
repetitive or near-duplicate questions just to hit a number.)

For every question:
- Base it directly on a specific part of the course material.
- Include a short "source" field pointing to the relevant section/topic, if
  identifiable.
- Include a concise explanation (2-3 sentences) for the correct answer, at the
  ${profile.koreanLevel} complexity level, weighted per the learning-goal
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
    "encouragement": "string (one light closing line, written after seeing question difficulty — not generic)",
    "weakAreaHints": ["string (concepts worth revisiting, drawn from the material)"]
  }
}

If the material doesn't support all requested questions, generate fewer rather
than inventing content, and add a top-level "note" field explaining why.

${materialBlock(courseMaterial)}`;
}
