import { createGeminiProvider } from './gemini.js';
import { createAnthropicProvider } from './anthropic.js';

const FACTORIES = {
  gemini: createGeminiProvider,
  anthropic: createAnthropicProvider,
};

/**
 * Builds the provider named by AI_PROVIDER (default: gemini).
 *
 * Swapping providers is meant to be a one-line .env change — every provider
 * exposes the same `generate({system, prompt, history, document, json})`
 * shape, so nothing above this layer knows which one is running.
 */
export function createProvider(env) {
  const requested = (env.AI_PROVIDER || 'gemini').toLowerCase();
  const factory = FACTORIES[requested];

  if (!factory) {
    const known = Object.keys(FACTORIES).join(', ');
    throw new Error(`Unknown AI_PROVIDER "${requested}". Known: ${known}.`);
  }

  return factory(env);
}
