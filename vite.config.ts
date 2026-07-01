import { defineConfig } from 'vitest/config'

// FT8 デコード用の WASM を将来同期ロードするため、SharedArrayBuffer を許可する
// クロスオリジン隔離ヘッダを dev サーバに付与しておく（本番は Pages 側で設定）。
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    // ブラウザ API（localStorage / DOM）に依存する純ロジックを Node 上で検証するため
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['test/unit/setup.ts'],
  },
})
