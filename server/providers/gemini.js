/**
 * Google Gemini provider (default).
 *
 * Free tier, no credit card: https://aistudio.google.com/apikey
 * Chosen over text-only providers because it accepts the PDF natively, which
 * matters for Korean lecture slides — extracting text from those with pdf.js
 * often yields garbled or out-of-order output.
 *
 * Raw REST rather than the SDK: this file is a thin dev-server proxy, and
 * fetch keeps the dependency surface at zero.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const UPLOAD_ENDPOINT = 'https://generativelanguage.googleapis.com/upload';

/**
 * Transient upstream failures to retry: rate limiting and capacity. The free
 * tier returns 503 "high demand" often enough that a single attempt makes the
 * long generations (translation, quiz) feel broken when they aren't.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// gemini-2.5-flash is closed to new API keys; 3.6-flash is the current
// free-tier flash model with a 1M-token context and 65K output.
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export function createGeminiProvider(env) {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: 'gemini',
    model,
    configured: Boolean(apiKey),
    setupHint:
      'Set GEMINI_API_KEY in .env (copy .env.example). Create a free key at ' +
      'https://aistudio.google.com/apikey — no credit card required.',

    /** Retries transient upstream failures with exponential backoff. */
    /**
     * Uploads a document to the Files API and returns a reference to it.
     *
     * This runs server-side rather than letting the browser upload directly.
     * A direct upload looked attractive (it would dodge serverless body
     * limits), and the CORS *preflight* does pass — but the actual upload
     * response carries no Access-Control-Allow-Origin header, so the browser
     * refuses to read it and fetch() rejects. Preflight success is not
     * sufficient; the real response must be readable too.
     */
    async uploadDocument({ name, mimeType, base64 }) {
      if (!apiKey) {
        throw Object.assign(new Error('GEMINI_API_KEY is not set.'), {
          status: 503,
          hint: this.setupHint,
        });
      }

      const bytes = Buffer.from(base64, 'base64');

      // 1. Start a resumable session.
      const start = await fetch(`${UPLOAD_ENDPOINT}/v1beta/files`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(bytes.length),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: name } }),
      });

      if (!start.ok) {
        const payload = await start.json().catch(() => null);
        throw Object.assign(
          new Error(
            payload?.error?.message ||
              `Could not start the upload (HTTP ${start.status}).`,
          ),
          { status: start.status },
        );
      }

      const uploadUrl = start.headers.get('x-goog-upload-url');
      if (!uploadUrl) {
        throw Object.assign(
          new Error('The upload service did not return an upload URL.'),
          { status: 502 },
        );
      }

      // 2. Send the bytes and finalize.
      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
          'content-type': mimeType,
        },
        body: bytes,
      });

      if (!upload.ok) {
        throw Object.assign(
          new Error(`The upload failed (HTTP ${upload.status}).`),
          { status: upload.status },
        );
      }

      const result = await upload.json().catch(() => null);
      const uri = result?.file?.uri;

      if (!uri) {
        throw Object.assign(
          new Error('The upload finished but returned no file reference.'),
          { status: 502 },
        );
      }

      return {
        mode: 'file',
        file: { uri, mimeType: result.file.mimeType || mimeType },
      };
    },

    async generate(options) {
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          return await this.attemptGenerate(options);
        } catch (error) {
          lastError = error;
          if (!RETRYABLE.has(error.status) || attempt === MAX_ATTEMPTS) throw error;

          const backoffMs = 1200 * 2 ** (attempt - 1);
          console.warn(
            `[gemini] ${error.status} on attempt ${attempt}/${MAX_ATTEMPTS}; ` +
              `retrying in ${backoffMs}ms`,
          );
          await sleep(backoffMs);
        }
      }

      throw lastError;
    },

    async attemptGenerate({
      system,
      prompt,
      history = [],
      document = null,
      json = false,
      maxOutputTokens = 32768,
      temperature = 0.4,
    }) {
      if (!apiKey) {
        throw Object.assign(new Error('GEMINI_API_KEY is not set.'), {
          status: 503,
          hint: this.setupHint,
        });
      }

      // A document arrives either as a Files API reference (the normal path —
      // the browser uploaded straight to Google) or as inline base64 bytes.
      let documentPart = null;
      if (document?.uri) {
        documentPart = {
          fileData: { mimeType: document.mimeType, fileUri: document.uri },
        };
      } else if (document?.data) {
        documentPart = {
          inlineData: { mimeType: document.mimeType, data: document.data },
        };
      }

      const contents = [];

      if (history.length > 0) {
        // Chat: anchor the document in the first turn, then replay history.
        const opening = { role: 'user', parts: [] };
        if (documentPart) opening.parts.push(documentPart);
        opening.parts.push({
          text: 'This is the course material for our conversation.',
        });
        contents.push(opening);
        contents.push({
          role: 'model',
          parts: [
            {
              text:
                'Understood. I will answer only from this material and say so ' +
                'plainly when something is not covered in it.',
            },
          ],
        });

        for (const turn of history) {
          contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          });
        }

        contents.push({ role: 'user', parts: [{ text: prompt }] });
      } else {
        const parts = [];
        if (documentPart) parts.push(documentPart);
        parts.push({ text: prompt });
        contents.push({ role: 'user', parts });
      }

      const body = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: json ? 'application/json' : 'text/plain',
        },
      };

      if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
      }

      let response;
      try {
        response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw Object.assign(new Error('Could not reach the Gemini API.'), {
          status: 502,
          hint: 'Check your network connection.',
          cause,
        });
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.error?.message || `Gemini returned HTTP ${response.status}.`;
        const error = Object.assign(new Error(message), {
          status: response.status,
        });

        if (response.status === 503) {
          error.hint =
            'The model is busy upstream. This is temporary — try again in a ' +
            'few moments.';
        } else if (response.status === 429) {
          error.hint =
            'Free-tier rate limit hit (roughly 10–15 requests/minute, ' +
            '~250/day). Wait a moment and try again.';
        } else if (response.status === 400 && /API key/i.test(message)) {
          error.hint = this.setupHint;
        }

        throw error;
      }

      const candidate = payload?.candidates?.[0];

      // A blocked prompt comes back 200 with no candidate.
      if (!candidate) {
        const blockReason = payload?.promptFeedback?.blockReason;
        throw Object.assign(
          new Error(
            blockReason
              ? `The request was blocked by a safety filter (${blockReason}).`
              : 'Gemini returned no content.',
          ),
          { status: 502 },
        );
      }

      const text = (candidate.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('');

      return {
        text,
        truncated: candidate.finishReason === 'MAX_TOKENS',
        model,
        usage: payload?.usageMetadata ?? null,
      };
    },
  };
}
