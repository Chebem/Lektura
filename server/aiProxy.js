/**
 * Vite dev-server middleware — the dev-time half of the API.
 *
 * All real behaviour lives in `server/handlers.js`, shared with the Netlify
 * functions, so `npm run dev` and the deployed site can't drift apart. This
 * file only adapts Node's req/res to those handlers.
 *
 * The API key is read here from `.env` (no VITE_ prefix, so Vite refuses to
 * inline it into the client bundle) and never leaves the server.
 */

import { loadEnv } from 'vite';
import {
  getProvider,
  handleHealth,
  handleStartUpload,
  handleAi,
} from './handlers.js';

const MAX_BODY_BYTES = 12 * 1024 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(
          Object.assign(new Error('That request body is too large.'), {
            status: 413,
          }),
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
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
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  const status = error.status ?? 500;
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
      // Same lookup Vite does, minus the VITE_ prefix filter — that filter is
      // exactly what keeps these values out of the client bundle.
      const env = loadEnv(server.config.mode, server.config.root, '');
      const provider = getProvider(env);

      if (!provider.configured) {
        server.config.logger.warn(
          `\n  [StudyBridge] No API key for provider "${provider.name}".\n` +
            `  ${provider.setupHint}\n`,
        );
      }

      const route = (path, handler) => {
        server.middlewares.use(path, async (req, res, next) => {
          if (path !== '/api/health' && req.method !== 'POST') return next();
          try {
            const body =
              req.method === 'POST' ? await readJsonBody(req) : {};
            const { status, body: payload } = await handler(provider, body);
            sendJson(res, status, payload);
          } catch (error) {
            sendError(res, error);
          }
        });
      };

      route('/api/health', (p) => handleHealth(p));
      route('/api/documents', handleStartUpload);
      route('/api/ai', handleAi);
    },
  };
}
