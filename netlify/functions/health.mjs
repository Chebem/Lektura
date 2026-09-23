import { handleHealth } from '../../server/handlers.js';
import { createFunction } from './_shared.mjs';

export default createFunction((provider) => handleHealth(provider), {
  methods: ['GET'],
});
