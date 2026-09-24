/**
 * The single module every AI feature goes through.
 *
 * There is no API key in this file, or anywhere else in src/. Each function
 * posts to the dev-server proxy (`server/aiProxy.js`), which attaches the key
 * server-side. That's why these are relative URLs.
 *
 * Every function: builds its prompt from data/promptTemplates.js, strips
 * markdowns fences defensively, parses JSON in a try/catch, and throws an
 * `AiError` carrying a message the UI can show a student verbatim.
 */

import {
  translationPrompt,
  chatbotSystemPrompt,
  flashcardsPrompt,
  quizTutorSystemPrompt,
} from '../data/promptTemplates.js';

export class AiError extends Error {
  constructor(message, { hint = null, status = null } = {}) {
    super(message);
    this.name = 'AiError';
    this.hint = hint;
    this.status = status;
  }
}

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new AiError('Could not reach Lektura server.', {
      hint: 'Is the dev server still running?',
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new AiError(payload?.error || `Request failed (${response.status}).`, {
      hint: payload?.hint ?? null,
      status: response.status,
    });
  }

  return payload;
}

/** Models sometimes wrap JSON in ```json fences despite being told not to. */
function stripFences(text) {
  const trimmed = (text ?? '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

/**
 * Parses model JSON, falling back to the outermost {...} span if there's
 * stray prose around it.
 */
function parseJson(text, what) {
  const cleaned = stripFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through to the thrown error below */
      }
    }
  }

  throw new AiError(`The AI returned ${what} in a format we couldn't read.`, {
    hint: 'Trying again usually fixes this.',
  });
}

function truncationHint(truncated) {
  return truncated
    ? 'The response hit its length limit, so the end may be cut off.'
    : null;
}

// --- Provider status -------------------------------------------------------

export async function checkProvider() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('health check failed');
    return await response.json();
  } catch {
    return { provider: 'unknown', configured: false, hint: null };
  }
}

// --- Document upload -------------------------------------------------------

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new AiError('That file could not be read from disk.'));
    reader.onload = () => {
      // Strip the `data:<type>;base64,` prefix.
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sends the document to our server, which uploads it to the AI provider and
 * returns a reference used by every later call.
 *
 * The bytes go through our server rather than straight to the provider: the
 * provider's upload endpoint passes CORS preflight but its actual response
 * carries no Access-Control-Allow-Origin header, so a browser upload can
 * never read the result.
 *
 * Returns a `source` descriptor to hand to every AI call.
 */
async function uploadBlob({ name, mimeType, blob }) {
  const data = await fileToBase64(blob);

  const result = await postJson('/api/documents', { name, mimeType, data });

  // Providers without a Files API (the Anthropic adapter) want the bytes to
  // ride along with each request instead.
  if (result.mode === 'inline') {
    return {
      kind: 'inline',
      name,
      mimeType,
      size: blob.size,
      document: { data, mimeType },
    };
  }

  if (!result.file?.uri) {
    throw new AiError('The upload finished but no file reference came back.');
  }

  return {
    kind: 'file',
    name,
    mimeType,
    size: blob.size,
    file: result.file,
  };
}

/** Uploads a PDF as-is — the model reads PDFs natively. */
export async function uploadPdf(file) {
  return uploadBlob({
    name: file.name,
    mimeType: 'application/pdf',
    blob: file,
  });
}

/**
 * Uploads text extracted from a Word or PowerPoint file.
 *
 * The model has no native Word/PowerPoint support, so those are converted to
 * text in the browser first (see lib/extractDocument.js) and uploaded as
 * text/plain.
 */
export async function uploadExtractedText(name, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  return uploadBlob({ name, mimeType: 'text/plain', blob });
}

/** Turns a source descriptor into the request fields the server expects. */
function sourceFields(source) {
  if (!source) return {};
  if (source.kind === 'file') return { file: source.file };
  return { document: source.document };
}

// --- 1. Translation --------------------------------------------------------

export async function getTranslation(source, profile) {
  const result = await postJson('/api/ai', {
    task: 'translation',
    ...sourceFields(source),
    json: true,
    prompt: translationPrompt(profile),
  });

  const parsed = parseJson(result.text, 'the translation');
  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

  if (sections.length === 0) {
    throw new AiError('The AI returned an empty translation.', {
      hint: 'If the PDF is a scan, its text may not be machine-readable.',
    });
  }

  return {
    sections: sections.map((section) => ({
      heading: section.heading ?? null,
      type: ['paragraph', 'list', 'table'].includes(section.type)
        ? section.type
        : 'paragraph',
      body: section.body,
      page: Number.isFinite(section.page) ? section.page : null,
    })),
    warning: truncationHint(result.truncated),
  };
}

// --- 2. Chatbot ------------------------------------------------------------

export async function askChatbot(source, profile, chatHistory, userMessage) {
  const result = await postJson('/api/ai', {
    task: 'chat',
    ...sourceFields(source),
    json: false,
    system: chatbotSystemPrompt(profile),
    prompt: userMessage,
    // Send only the plain turns; local-only fields (ids, error flags) stay out.
    history: chatHistory
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({ role: turn.role, content: turn.content })),
  });

  const answer = stripFences(result.text);

  if (!answer) {
    throw new AiError('The AI returned an empty answer.', {
      hint: 'Try rephrasing the question.',
    });
  }

  return answer;
}

// --- 3. Flashcards ---------------------------------------------------------

const VALID_CATEGORIES = new Set([
  'Vocab',
  'Terminology',
  'Sentence Pattern',
  'Grammar',
  'Concept',
]);

export async function getFlashcards(source, profile) {
  const result = await postJson('/api/ai', {
    task: 'flashcards',
    ...sourceFields(source),
    json: true,
    prompt: flashcardsPrompt(profile),
  });

  const parsed = parseJson(result.text, 'the flashcards');

  // Accept the older `flashcards` key too, so a cached or older response
  // still renders instead of showing an empty deck.
  const raw = Array.isArray(parsed.cards)
    ? parsed.cards
    : Array.isArray(parsed.flashcards)
      ? parsed.flashcards
      : [];

  const cards = raw
    .map((card, index) => normalizeCard(card, index))
    .filter(Boolean);

  if (cards.length === 0) {
    throw new AiError('No learning cards could be generated from this document.', {
      hint: 'Very short or image-only documents often have too little text to work with.',
    });
  }

  return { cards, warning: truncationHint(result.truncated) };
}

/** Model output is untrusted: coerce every field and drop unusable cards. */
function normalizeCard(card, index) {
  if (!card) return null;

  // `front`/`back` is the older shape; map it onto the new one.
  const term = card.term ?? card.front;
  const translation = card.translation ?? card.back;
  if (!term) return null;

  const text = (value) =>
    value == null || value === '' ? null : String(value);

  return {
    id: `card-${index}`,
    term: String(term),
    romanization: text(card.romanization),
    translation: text(translation) ?? '',
    category: VALID_CATEGORIES.has(card.category) ? card.category : 'Vocab',
    examPriority: card.examPriority === true,
    generalMeaning: text(card.generalMeaning),
    courseMeaning: text(card.courseMeaning),
    exampleKo: text(card.exampleKo),
    exampleEn: text(card.exampleEn),
    source: text(card.source),
  };
}

// --- 4. Quiz tutor (one turn at a time) ------------------------------------

/**
 * One turn of the quiz conversation.
 *
 * `history` is the running transcript; the model reads it to keep score and
 * to know which question it's on, so nothing is stored server-side.
 */
export async function askQuizTutor(source, profile, history, userMessage) {
  const result = await postJson('/api/ai', {
    task: 'chat',
    ...sourceFields(source),
    json: true,
    system: quizTutorSystemPrompt(profile),
    prompt: userMessage,
    history: history
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({ role: turn.role, content: turn.content })),
  });

  const parsed = parseJson(result.text, "the tutor's reply");
  return normalizeTurn(parsed);
}

/** Model output is untrusted; give the UI a shape it can always render. */
function normalizeTurn(turn) {
  const text = (value) => (value == null || value === '' ? null : String(value));

  const finished = turn.finished === true;
  let options = Array.isArray(turn.options) ? turn.options.map(String) : [];
  const questionType =
    turn.questionType === 'true_false' ? 'true_false' : 'multiple_choice';

  if (questionType === 'true_false' && options.length !== 2) {
    options = ['True', 'False'];
  }

  const question = finished ? null : text(turn.question);
  if (!question) options = [];

  const answered = Number(turn.score?.answered);
  const correct = Number(turn.score?.correct);

  return {
    reply: text(turn.reply) ?? '',
    verdict:
      turn.verdict === 'correct' || turn.verdict === 'incorrect'
        ? turn.verdict
        : null,
    explanation: text(turn.explanation),
    question,
    questionType: question ? questionType : null,
    options,
    questionNumber: Number.isFinite(turn.questionNumber)
      ? turn.questionNumber
      : null,
    totalQuestions: Number.isFinite(turn.totalQuestions)
      ? turn.totalQuestions
      : null,
    score: {
      correct: Number.isFinite(correct) ? correct : 0,
      answered: Number.isFinite(answered) ? answered : 0,
    },
    finished,
    source: text(turn.source),
  };
}
