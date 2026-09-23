/**
 * Framework-agnostic request handlers — the actual behaviour of the API.
 *
 * These are shared by both places the API is served from, so dev and
 * production can never drift apart:
 *   - `server/aiProxy.js`        Vite dev-server middleware (Node req/res)
 *   - `netlify/functions/*.mjs`  serverless functions (Request/Response)
 *
 * Each handler takes plain data and returns `{ status, body }`. Nothing here
 * knows about HTTP plumbing, and the API key never leaves this layer.
 */

import { createProvider } from './providers/index.js';

/** Per-task output ceiling. Translation needs the most room. */
const TASK_LIMITS = {
  translation: 65536,
  chat: 2048,
  flashcards: 16384,
  quiz: 24576,
};

/** Formats we can send to the model. Office files are extracted to text
 *  client-side first, so they arrive as text/plain. */
const ACCEPTED_UPLOAD_TYPES = new Set(['application/pdf', 'text/plain']);

export function getProvider(env) {
  return createProvider(env);
}

export function handleHealth(provider) {
  return {
    status: 200,
    body: {
      provider: provider.name,
      model: provider.model,
      configured: provider.configured,
      hint: provider.configured ? null : provider.setupHint,
    },
  };
}

/**
 * Receives the document, uploads it to the provider, and returns a reference.
 *
 * The bytes pass through this server. An earlier design had the browser
 * upload straight to the provider to dodge serverless body limits, but the
 * provider's upload response carries no CORS headers, so the browser cannot
 * read it. See the note in providers/gemini.js.
 *
 * Consequence to be aware of: serverless hosts cap request bodies (Netlify
 * ~6MB), so on a deployed site this path only supports files up to roughly
 * 4MB before base64 expansion pushes them over. Large-file support needs
 * chunked forwarding; tracked in TASK.md.
 */
export async function handleUpload(provider, body) {
  const { name, mimeType, data } = body ?? {};

  if (!mimeType || !ACCEPTED_UPLOAD_TYPES.has(mimeType)) {
    throw Object.assign(
      new Error(`Unsupported upload type: ${mimeType || 'unknown'}.`),
      {
        status: 415,
        hint: 'PDFs upload directly; Word and PowerPoint files are converted to text first.',
      },
    );
  }

  if (!data || typeof data !== 'string') {
    throw Object.assign(new Error('No file data was received.'), {
      status: 400,
    });
  }

  return {
    status: 200,
    body: await provider.uploadDocument({
      name: name || 'document',
      mimeType,
      base64: data,
    }),
  };
}

/** Runs one AI call. `file` is a Files API reference; `document` is inline. */
export async function handleAi(provider, body) {
  const {
    task,
    prompt,
    system = null,
    history = [],
    json = false,
    file = null,
    document = null,
  } = body ?? {};

  if (!prompt || typeof prompt !== 'string') {
    throw Object.assign(new Error('A prompt is required.'), { status: 400 });
  }

  let attachment = null;
  if (file?.uri) {
    attachment = { uri: file.uri, mimeType: file.mimeType || 'application/pdf' };
  } else if (document?.data) {
    attachment = {
      data: document.data,
      mimeType: document.mimeType || 'application/pdf',
    };
  }

  const result = await provider.generate({
    system,
    prompt,
    history: Array.isArray(history) ? history : [],
    document: attachment,
    json: Boolean(json),
    maxOutputTokens: TASK_LIMITS[task] ?? 8192,
  });

  return {
    status: 200,
    body: {
      text: result.text,
      truncated: Boolean(result.truncated),
      model: result.model,
      provider: provider.name,
    },
  };
}
