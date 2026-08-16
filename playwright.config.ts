import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4397/reflectometry/', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4397 --strictPort',
    url: 'http://127.0.0.1:4397/reflectometry/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, colorScheme: 'dark' } },
  ],
})
