// Browser tests: screenshot comparisons and axe accessibility scans.
// Serves the built site (dist/) with `vite preview`; run `npm run test:e2e`,
// which builds first. Chromium only.
//
// Screenshot baselines are Linux + Chromium renders (file names end in
// -linux.png). Font rendering differs on macOS and Windows, so compare
// against these baselines in a Linux environment.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `vite preview --outDir dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
