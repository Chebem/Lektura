/**
 * Netlify Functions adapter around the shared handlers in server/handlers.js.
 *
 * Production reads the key from Netlify's environment variables (set in the
 * site dashboard, never committed), while dev reads the same names from .env.
 */

import { getProvider } from '../../server/handlers.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** Wraps a handler with body parsing, method checking and error shaping. */
export function createFunction(handler, { methods = ['POST'] } = {}) {
  return async function netlifyHandler(request) {
    if (!methods.includes(request.method)) {
      return json(405, { error: `Use ${methods.join(' or ')}.` });
    }

    try {
      const provider = getProvider(process.env);

      let body = {};
      if (request.method === 'POST') {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            return json(400, { error: 'Request body was not valid JSON.' });
          }
        }
      }

      const { status, body: payload } = await handler(provider, body);
      return json(status, payload);
    } catch (error) {
      const status = error.status ?? 500;
      console.error(`[${request.method} ${request.url}] ${status} — ${error.message}`);
      return json(status, {
        error: error.message || 'Something went wrong.',
        hint: error.hint ?? null,
      });
    }
  };
}
