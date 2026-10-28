import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // относительные пути: сайт работает из любой папки хостинга
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
