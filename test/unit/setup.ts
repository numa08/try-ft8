import { afterEach } from 'vitest'

// LocalStorage 依存テストが互いに干渉しないよう、各テスト後に初期化する。
afterEach(() => {
  localStorage.clear()
})
