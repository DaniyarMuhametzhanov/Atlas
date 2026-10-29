import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  // относительные пути: сайт работает из любой папки хостинга
  base: './',
  // версия без интернета (npm run build:offline): весь код и стили — внутри одного index.html,
  // данные и фото дописывает scripts/build-offline.ts
  plugins: mode === 'offline' ? [react(), viteSingleFile()] : [react()],
  // в одном файле папка public не нужна — её содержимое встраивается отдельно
  publicDir: mode === 'offline' ? false : 'public',
  // искать зависимости только от сайта, а не от старого атласа legacy/atlas-v1.html (15 МБ)
  optimizeDeps: { entries: ['index.html'] },
  // не следить за тысячами фото и исходниками: на Windows следилка падает (UNKNOWN: watch), пока build:images пишет файлы
  server: { watch: { ignored: ['**/public/img/**', '**/public/data/**', '**/assets-src/**', '**/legacy/**', '**/reports/**', '**/dist/**'] } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: mode === 'offline' ? 100_000 : 1500,
    outDir: mode === 'offline' ? 'dist-offline' : 'dist',
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
}));
