import { afterEach } from 'vitest'

// LocalStorage 依存テストが互いに干渉しないよう、各テスト後に初期化する。
// node 環境のテスト(WASM 往復など)では localStorage が無いためガードする。
afterEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})
