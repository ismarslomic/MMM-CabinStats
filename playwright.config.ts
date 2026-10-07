import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: '**/*.spec.ts',
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node __tests__/e2e/mock-backend.mjs',
      url: 'http://127.0.0.1:8081/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm --prefix MagicMirror run server',
      url: 'http://localhost:8080',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
