# Try! FT8

ブラウザだけで動く FT8 名刺交換デモ(WSJT-X 簡易版)。スマホのマイクとスピーカーで、3 文字ハンドルネームを
FT8 の音として送受信して交換する。

> **これはスピーカー ↔ マイク間の「音声」デモです。** 無線(RF)での電波送信は一切行わないため、
> アマチュア無線の免許は不要です。

- 公開URL: **https://ft8.numa08.dev**
- 仕様: [docs/SPEC.md](docs/SPEC.md) / 受入テスト設計: [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md)

## 技術スタック

- ビルド: Vite + TypeScript
- 音声: Web Audio API / FT8 エンコード・デコードは WASM(ft8_lib 由来、フリーテキストモード)
- 時刻: 起動時に `Date` ヘッダで秒境界を検出し `performance.now` 基準で補正(端末間の時計ズレ対策)
- 永続化: LocalStorage(交信ログ・ユーザー名)
- テスト: Vitest(単体, jsdom)/ Playwright(e2e)
- デプロイ: Cloudflare Workers(Static Assets)+ 独自ドメイン(ft8.numa08.dev)

## セットアップ

```sh
pnpm install
pnpm exec playwright install chromium   # e2e 用(初回のみ)
```

## スクリプト

| コマンド             | 用途                                   |
| -------------------- | -------------------------------------- |
| `pnpm dev`           | 開発サーバ                             |
| `pnpm build`         | 本番ビルド                             |
| `pnpm test`          | 単体テスト(Vitest)                     |
| `pnpm test:e2e`      | e2e テスト(Playwright)                 |
| `pnpm lint`          | ESLint                                 |
| `pnpm type-check`    | 型チェック(tsc)                        |
| `pnpm format`        | Prettier チェック                      |
| `pnpm demo`          | ビルド → 実機テスト用トンネル公開      |
| `pnpm run deploy:cf` | ビルド → Cloudflare Workers へデプロイ |

## 実機テスト(スマホ・複数台)

マイクは HTTPS でしか使えないため、Cloudflare クイックトンネルで一時 URL を発行して実機確認する。

```sh
pnpm demo   # = pnpm build && bash scripts/serve-tunnel.sh
```

表示される `https://<ランダム>.trycloudflare.com` を複数台のスマホで開き、各自 3 文字名を入力・
マイクを許可 → 端末を近づけて FT8 交信を試す(スピーカー音を相手のマイクが拾ってデコードする)。
`cloudflared` が必要(https://github.com/cloudflare/cloudflared)。

## デプロイ

Cloudflare Workers の Static Assets で配信(Pages ではなく Workers)。エッジ配信なので `Date`
ヘッダがエッジ(NTP同期)時刻になり、時刻補正に好都合。設定は [wrangler.jsonc](wrangler.jsonc)。

```sh
pnpm run deploy:cf          # = vite build && wrangler deploy
```

独自ドメイン `ft8.numa08.dev` は `custom_domain` ルートで DNS + 証明書を自動プロビジョニング。
デプロイ先アカウントは `wrangler whoami` で確認(個人アカウントにログインしておくこと)。

フォークして自分でデプロイする場合は [wrangler.jsonc](wrangler.jsonc) の `name` と `routes`
(`ft8.numa08.dev`)を自分の Worker 名・ドメインに書き換えること。

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

## ライセンス

本プロジェクトは [MIT License](LICENSE)(© 2026 numa08 (JK1TUT))で公開しています。

FT8 のエンコード・デコード中核は [ft8_lib](https://github.com/kgoba/ft8_lib)
(© 2018 Kārlis Goba, MIT)由来です。同梱している WASM バイナリおよび派生した C シムの
著作権・ライセンス表示は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) を参照してください。
