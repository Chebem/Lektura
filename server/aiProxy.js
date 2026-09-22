/**
 * Vite dev-server middleware: the only place the API key exists.
 *
 * The browser never sees a key. `.env` holds GEMINI_API_KEY *without* a VITE_
 * prefix, so Vite refuses to inline it into the client bundle; this middleware
 * reads it from process.env and attaches it to the upstream request.
 *
 * Routes
 *   GET  /api/health      → which provider is active and whether it has a key
 *   POST /api/documents   → store the uploaded PDF, return a document id
 *   POST /api/ai          → run one AI call against a stored document
 *
 * Deployment note: this runs under `vite dev` only. A static `vite build`
 * has no middleware, so a real deployment needs this logic re-hosted as a
 * serverless function. See README.
 */

import { loadEnv } from 'vite';
import { createProvider } from './providers/index.js';
import { putDocument, getDocument } from './documentStore.js';

const MAX_BODY_BYTES = 40 * 1024 * 1024; // ~30MB PDF once base64-encoded

/** Per-task output ceiling. Translation needs the most room. */
const TASK_LIMITS = {
  translation: 65536,
  chat: 2048,
  flashcards: 16384,
  quiz: 24576,
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(
          Object.assign(new Error('The uploaded file is too large.'), {
            status: 413,
            hint: 'Try a PDF under 30MB.',
          }),
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(
          Object.assign(new Error('Request body was not valid JSON.'), {
            status: 400,
          }),
        );
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function sendError(res, error) {
  const status = error.status ?? 500;
  // Log server-side with the full cause; send the client only what's useful.
  console.error(`[ai-proxy] ${status} — ${error.message}`);
  if (error.cause) console.error(error.cause);

  sendJson(res, status, {
    error: error.message || 'Something went wrong.',
    hint: error.hint ?? null,
  });
}

export function aiProxyPlugin() {
  return {
    name: 'studybridge-ai-proxy',

    configureServer(server) {
      // Read .env the same way Vite does, but without the VITE_ prefix
      // filter — that filter is exactly what keeps these out of the bundle.
      const env = loadEnv(server.config.mode, server.config.root, '');
      const provider = createProvider(env);

      if (!provider.configured) {
        server.config.logger.warn(
          `\n  [StudyBridge] No API key for provider "${provider.name}".\n` +
            `  ${provider.setupHint}\n` +
            '  The UI will load and the PDF viewer will work; AI features ' +
            'will report this until a key is set.\n',
        );
      }

      server.middlewares.use('/api/health', (req, res) => {
        sendJson(res, 200, {
          provider: provider.name,
          model: provider.model,
          configured: provider.configured,
          hint: provider.configured ? null : provider.setupHint,
        });
      });

      server.middlewares.use('/api/documents', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        try {
          const { name, mimeType, data, pageCount } = await readJsonBody(req);

          if (!data || typeof data !== 'string') {
            throw Object.assign(new Error('No file data was received.'), {
              status: 400,
            });
          }
          if (mimeType !== 'application/pdf') {
            throw Object.assign(
              new Error('Only PDF uploads are supported.'),
              { status: 415 },
            );
          }

          const stored = putDocument({
            name: name || 'document.pdf',
            mimeType,
            data,
            pageCount,
          });

          sendJson(res, 201, {
            documentId: stored.id,
            name: stored.name,
            bytes: stored.bytes,
            pageCount: stored.pageCount,
          });
        } catch (error) {
          sendError(res, error);
        }
      });

      server.middlewares.use('/api/ai', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        try {
          const body = await readJsonBody(req);
          const {
            task,
            prompt,
            system = null,
            documentId = null,
            history = [],
            json = false,
          } = body;

          if (!prompt || typeof prompt !== 'string') {
            throw Object.assign(new Error('A prompt is required.'), {
              status: 400,
            });
          }

          let document = null;
          if (documentId) {
            document = getDocument(documentId);
            if (!document) {
              throw Object.assign(
                new Error('That document is no longer on the server.'),
                {
                  status: 404,
                  hint: 'The dev server restarted — re-upload the PDF.',
                },
              );
            }
          }

          const result = await provider.generate({
            system,
            prompt,
            history: Array.isArray(history) ? history : [],
            document,
            json: Boolean(json),
            maxOutputTokens: TASK_LIMITS[task] ?? 8192,
          });

          sendJson(res, 200, {
            text: result.text,
            truncated: Boolean(result.truncated),
            model: result.model,
            provider: provider.name,
          });
        } catch (error) {
          sendError(res, error);
        }
      });
    },
  };
}
