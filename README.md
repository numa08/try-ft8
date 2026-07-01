# ft8-demo-on-web

ブラウザ上で動作する FT8 名刺交換デモ(WSJT-X 簡易版)。LT 用に、参加者がスマホで 3 文字ハンドルネームを
音声(FT8 フリーテキスト)で交換し合う。仕様は [docs/SPEC.md](docs/SPEC.md) を参照。

## 技術スタック

- ビルド: Vite + TypeScript
- 音声: Web Audio API / FT8 エンコード・デコードは WASM(ft8_lib 由来、フリーテキストモード)
- 永続化: LocalStorage
- テスト: Vitest(単体, jsdom)/ Playwright(e2e)
- デプロイ: Cloudflare Pages(HTTPS 必須)

## セットアップ

```sh
pnpm install
pnpm exec playwright install chromium   # e2e 用(初回のみ)
```

## スクリプト

| コマンド          | 用途                              |
| ----------------- | --------------------------------- |
| `pnpm dev`        | 開発サーバ                        |
| `pnpm build`      | 本番ビルド                        |
| `pnpm test`       | 単体テスト(Vitest)                |
| `pnpm test:e2e`   | e2e テスト(Playwright)            |
| `pnpm lint`       | ESLint                            |
| `pnpm type-check` | 型チェック(tsc)                   |
| `pnpm format`     | Prettier チェック                 |
| `pnpm demo`       | ビルド → 実機テスト用トンネル公開 |

## 実機テスト(スマホ・複数台)

マイクは HTTPS でしか使えないため、Cloudflare クイックトンネルで一時 URL を発行して実機確認する。

```sh
pnpm demo   # = pnpm build && bash scripts/serve-tunnel.sh
```

表示される `https://<ランダム>.trycloudflare.com` を複数台のスマホで開き、各自 3 文字名を入力・
マイクを許可 → 端末を近づけて FT8 交信を試す(スピーカー音を相手のマイクが拾ってデコードする)。
`cloudflared` が必要(https://github.com/cloudflare/cloudflared)。

## FT8 WASM の再生成

`src/audio/wasm/ft8.{mjs,wasm}` は ft8_lib(MIT)を Emscripten で WASM 化した生成物。
再生成は Docker が必要:

```sh
bash scripts/build-ft8-wasm.sh
```

## 設計方針

音声・時刻・DOM・乱数といった副作用を境界に押し出し、プロトコル中核(名前検証・メッセージ生成・
スロット計算・QSO ステートマシン・ログ永続化)を純ロジックとして単体テスト可能にしている。
受入テストの分類と検証方法は [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) を参照。

## 構成

```
src/
  domain/    プロトコル中核(純ロジック): name / message / slot / offset / log / qso
  audio/     FT8 WASM ラッパ(音声 ↔ テキスト)
  main.ts    エントリポイント
test/
  unit/      Vitest(自動化可能な AC)
  e2e/       Playwright(AC-24 ほか)
  fixtures/  AC-11 用ゴールデン音声
```
