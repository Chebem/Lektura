/**
 * The single module every AI feature goes through.
 *
 * There is no API key in this file, or anywhere else in src/. Each function
 * posts to the dev-server proxy (`server/aiProxy.js`), which attaches the key
 * server-side. That's why these are relative URLs.
 *
 * Every function: builds its prompt from data/promptTemplates.js, strips
 * markdown fences defensively, parses JSON in a try/catch, and throws an
 * `AiError` carrying a message the UI can show a student verbatim.
 */

import {
  translationPrompt,
  chatbotSystemPrompt,
  flashcardsPrompt,
  quizPrompt,
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
    throw new AiError('Could not reach the StudyBridge server.', {
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
      // Strip the `data:application/pdf;base64,` prefix.
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads the PDF once and returns a document id used by every later call.
 * Keeping the bytes server-side means chat turns stay small.
 */
export async function uploadDocument(file, pageCount = null) {
  if (file.type !== 'application/pdf') {
    throw new AiError('StudyBridge works with PDF files.', {
      hint: 'Export your lecture notes or slides to PDF first.',
    });
  }

  const data = await fileToBase64(file);

  const result = await postJson('/api/documents', {
    name: file.name,
    mimeType: file.type,
    data,
    pageCount,
  });

  return result;
}

// --- 1. Translation --------------------------------------------------------

export async function getTranslation(documentId, profile) {
  const result = await postJson('/api/ai', {
    task: 'translation',
    documentId,
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

export async function askChatbot(documentId, profile, chatHistory, userMessage) {
  const result = await postJson('/api/ai', {
    task: 'chat',
    documentId,
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

export async function getFlashcards(documentId, profile) {
  const result = await postJson('/api/ai', {
    task: 'flashcards',
    documentId,
    json: true,
    prompt: flashcardsPrompt(profile),
  });

  const parsed = parseJson(result.text, 'the flashcards');
  const cards = (Array.isArray(parsed.flashcards) ? parsed.flashcards : [])
    .filter((card) => card && card.front && card.back)
    .map((card, index) => ({
      id: `card-${index}`,
      front: String(card.front),
      back: String(card.back),
      source: card.source ? String(card.source) : null,
    }));

  if (cards.length === 0) {
    throw new AiError('No flashcards could be generated from this document.', {
      hint: 'Very short or image-only PDFs often have too little text to work with.',
    });
  }

  return { cards, warning: truncationHint(result.truncated) };
}

// --- 4. Quiz ---------------------------------------------------------------

export async function getQuiz(documentId, profile) {
  const result = await postJson('/api/ai', {
    task: 'quiz',
    documentId,
    json: true,
    prompt: quizPrompt(profile),
  });

  const parsed = parseJson(result.text, 'the quiz');
  const rawQuestions = Array.isArray(parsed.quiz) ? parsed.quiz : [];

  const questions = rawQuestions
    .map((question, index) => normalizeQuestion(question, index))
    .filter(Boolean);

  if (questions.length === 0) {
    throw new AiError('No quiz questions could be generated from this document.', {
      hint: 'Very short or image-only PDFs often have too little text to work with.',
    });
  }

  return {
    questions,
    summary: {
      encouragement: parsed.summary?.encouragement ?? null,
      weakAreaHints: Array.isArray(parsed.summary?.weakAreaHints)
        ? parsed.summary.weakAreaHints.map(String)
        : [],
    },
    note: parsed.note ? String(parsed.note) : null,
    warning: truncationHint(result.truncated),
  };
}

/**
 * Drops any question the UI couldn't render honestly — a multiple choice whose
 * correct answer isn't among its options would show the student a question
 * with no right answer, which is worse than showing one fewer question.
 */
function normalizeQuestion(question, index) {
  if (!question || typeof question.question !== 'string') return null;

  const base = {
    id: `q-${index}`,
    question: question.question,
    reaction: question.reaction ? String(question.reaction) : null,
    explanation: question.explanation ? String(question.explanation) : '',
    source: question.source ? String(question.source) : null,
  };

  if (question.type === 'true_false') {
    const answer =
      typeof question.correctAnswer === 'boolean'
        ? question.correctAnswer
        : String(question.correctAnswer).toLowerCase() === 'true';

    return {
      ...base,
      type: 'true_false',
      options: ['True', 'False'],
      correctAnswer: answer ? 'True' : 'False',
    };
  }

  const options = (Array.isArray(question.options) ? question.options : []).map(
    String,
  );
  const correctAnswer =
    question.correctAnswer == null ? '' : String(question.correctAnswer);

  if (options.length < 2 || !options.includes(correctAnswer)) return null;

  return { ...base, type: 'multiple_choice', options, correctAnswer };
}