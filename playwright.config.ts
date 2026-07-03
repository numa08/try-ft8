import { defineConfig, devices } from '@playwright/test'

// AC-24（起動〜メイン画面描画）を実ブラウザで確認する e2e 設定。
// マイク許可はブラウザ権限の付与とフェイク音声デバイスで自動化する。
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // 既定表示言語はブラウザ言語で決まる。既存の受入テストは日本語 UI を前提とするため固定する。
    locale: 'ja-JP',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
