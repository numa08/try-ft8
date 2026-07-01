import { test, expect } from '@playwright/test'

// AC-24(空き箱防止): 起動 → 名前ダイアログ → 名前確定 → 開始 → マイク許可承認 →
// Start Sequence ボタンとログ一覧を含む受信モードのメイン画面が描画されること。
// マイク許可は playwright.config.ts の --use-fake-ui/-device で自動承認される。
test('起動〜メイン画面描画 (AC-1, AC-4, AC-24, AC-30)', async ({ page }) => {
  await page.goto('/')

  // AC-1: 名前入力ダイアログと注意文(録音/スピーカー/非送信)。
  const dialog = page.getByTestId('name-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('マイク')
  await expect(dialog).toContainText('スピーカー')
  await expect(dialog).toContainText('保存')

  // 名前を確定して開始(AC-3: 開始で AudioContext 確立・マイク許可要求)。
  await page.getByTestId('name-input').fill('ABC')
  await page.getByTestId('start-button').click()

  // AC-4 / AC-24: 受信モードのメイン画面に遷移し、主要 UI が描画される。
  const main = page.getByTestId('main-screen')
  await expect(main).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Sequence' })).toBeVisible()
  await expect(page.getByTestId('qso-log')).toBeVisible()

  // AC-30: 適用した時刻オフセットの表示(time.is リンクは廃止)。
  await expect(page.getByTestId('clock-offset')).toBeVisible()
})

// AC-2: 名前バリデーション(UI 層)。不正な名前は確定を拒否し理由を表示。
test('不正な名前は拒否され理由が表示される (AC-2)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('name-input').fill('abcd')
  await page.getByTestId('start-button').click()
  await expect(page.getByTestId('name-dialog')).toBeVisible() // 遷移しない
  await expect(page.getByTestId('name-error')).toBeVisible()
})

// AC-33: 設定した名前は LocalStorage に永続化され、再読み込み後も初期値として復元される。
test('設定した名前は再読み込み後も復元される (AC-33)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('name-input').fill('ABC')
  await page.getByTestId('start-button').click()
  await expect(page.getByTestId('main-screen')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('name-input')).toHaveValue('ABC')
})
