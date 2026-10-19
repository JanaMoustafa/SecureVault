import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Vitest runs inside `frontend/`, but our test files live in `../tests/`.
  // Allow Vite/Vitest to read those files.
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  // The provided test file is named `frontend.test.js` but contains JSX.
  // Ensure esbuild parses those test files with the JSX loader.
  esbuild: {
    loader: 'jsx',
    include: [/.*tests[\\/]frontend[\\/].*\.js$/],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    include: ['tests/**/*.test.jsx'],
    server: {
      deps: {
        inline: ['msw'],
      },
    },
  },
});
