/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In Docker the backend's PDF renderer loads print.html from the "frontend" container.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['frontend'] },
  build: {
    rollupOptions: {
      input: { main: 'index.html', print: 'print.html' },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
