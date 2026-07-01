// アプリのエントリポイント(プレースホルダ)。
// UI・音声・時刻同期の結線は /goal による自律実装で構築する。
// 受入テスト(test/)が定義する契約(名前ダイアログ、メイン画面、Start Sequence、ログ一覧など)を満たすこと。
const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  app.textContent = 'FT8 名刺交換デモ (実装予定)'
}
