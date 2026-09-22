import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiProxyPlugin } from './server/aiProxy.js';

export default defineConfig({
  // aiProxyPlugin adds the /api/* dev-server routes that hold the API key
  // server-side. Nothing in src/ ever sees a key.
  plugins: [react(), aiProxyPlugin()],
  server: {
    port: 5173,
  },
});