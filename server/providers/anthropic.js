/**
 * Anthropic (Claude) provider — the alternative the original spec called for.
 *
 * Not the default because the Anthropic API has no free tier. To switch:
 *   1. npm install @anthropic-ai/sdk
 *   2. put ANTHROPIC_API_KEY in .env
 *   3. set AI_PROVIDER=anthropic in .env
 *
 * The SDK is imported dynamically so it stays an optional dependency — the
 * Gemini path doesn't need it installed.
 */

const DEFAULT_MODEL = 'claude-opus-5';

let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    // @vite-ignore keeps the bundler from trying to resolve an optional dep.
    sdkPromise = import(/* @vite-ignore */ '@anthropic-ai/sdk').then(
      (mod) => mod.default ?? mod.Anthropic,
      (cause) => {
        throw Object.assign(
          new Error('The @anthropic-ai/sdk package is not installed.'),
          {
            status: 503,
            hint: 'Run: npm install @anthropic-ai/sdk',
            cause,
          },
        );
      },
    );
  }
  return sdkPromise;
}

export function createAnthropicProvider(env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  let client = null;

  return {
    name: 'anthropic',
    model,
    configured: Boolean(apiKey),
    setupHint:
      'Set ANTHROPIC_API_KEY in .env and run `npm install @anthropic-ai/sdk`. ' +
      'The Anthropic API requires billing credit — see console.anthropic.com.',

    /**
     * Anthropic has its own Files API, but this adapter keeps documents inline
     * so the fallback provider stays dependency-light. The client is told
     * 'inline' and sends bytes with each request instead of uploading once.
     */
    async startUpload() {
      return { mode: 'inline' };
    },

    async generate({
      system,
      prompt,
      history = [],
      document = null,
      json = false,
      maxOutputTokens = 32000,
    }) {
      if (!apiKey) {
        throw Object.assign(new Error('ANTHROPIC_API_KEY is not set.'), {
          status: 503,
          hint: this.setupHint,
        });
      }

      const Anthropic = await loadSdk();
      if (!client) client = new Anthropic({ apiKey });

      const messages = [];

      if (history.length > 0) {
        const openingParts = [];
        if (document) {
          openingParts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: document.mimeType,
              data: document.data,
            },
          });
        }
        openingParts.push({
          type: 'text',
          text: 'This is the course material for our conversation.',
        });
        messages.push({ role: 'user', content: openingParts });
        messages.push({
          role: 'assistant',
          content:
            'Understood. I will answer only from this material and say so ' +
            'plainly when something is not covered in it.',
        });

        for (const turn of history) {
          messages.push({ role: turn.role, content: turn.content });
        }

        messages.push({ role: 'user', content: prompt });
      } else {
        const parts = [];
        if (document) {
          parts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: document.mimeType,
              data: document.data,
            },
          });
        }
        parts.push({ type: 'text', text: prompt });
        messages.push({ role: 'user', content: parts });
      }

      const request = {
        model,
        max_tokens: maxOutputTokens,
        messages,
      };

      if (system) request.system = system;

      // JSON-returning tasks get a schema-constrained response; chat does not.
      if (json) {
        request.output_config = { format: { type: 'json_object' } };
      }

      try {
        // Streaming because max_tokens is large enough to risk an HTTP timeout
        // on a non-streaming request.
        const stream = client.messages.stream(request);
        const message = await stream.finalMessage();

        if (message.stop_reason === 'refusal') {
          throw Object.assign(
            new Error('Claude declined to answer this request.'),
            { status: 422 },
          );
        }

        const text = message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');

        return {
          text,
          truncated: message.stop_reason === 'max_tokens',
          model: message.model,
          usage: message.usage ?? null,
        };
      } catch (error) {
        if (error.status) throw error;
        throw Object.assign(
          new Error(error.message || 'The Anthropic request failed.'),
          { status: 502, cause: error },
        );
      }
    },
  };
}
