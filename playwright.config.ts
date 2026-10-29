// Сценарии в настоящем браузере (раздел 14 задания): npm run test:e2e
//
// Браузер: по умолчанию Chromium от Playwright (один раз: npx playwright install chromium).
// Можно взять уже установленный в системе: PW_CHANNEL=msedge npm run test:e2e (Edge есть в каждой Windows)
// или PW_CHANNEL=chrome.
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    channel: process.env.PW_CHANNEL || undefined,
    // карта рисуется через видеокарту (WebGL). Обычно браузер без окна рисует программно — это медленно, но одинаково везде.
    // PW_GPU=1 — открыть окно браузера с настоящей видеокартой (для замера скорости проигрывания)
    headless: !process.env.PW_GPU,
    launchOptions: { args: process.env.PW_GPU ? ['--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'компьютер-светлая', use: { viewport: { width: 1300, height: 850 }, colorScheme: 'light' } },
    { name: 'телефон-тёмная', use: { viewport: { width: 390, height: 800 }, colorScheme: 'dark' } },
  ],
});
