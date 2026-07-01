# 受入テスト設計 (Acceptance Test Design)

- 対象: `docs/SPEC.md` の受入基準 AC-1〜AC-32
- 目的: 各 AC を「自動テストで検証する / ハーネス(治具)を用意して検証する / 手動で検証する」に分類し、
  自動化可能なものはテスト実装の置き場所と検証方法を確定させる。
- 前提: 実装は音声 I/O・DOM・時刻・乱数といった副作用を **純粋なドメインロジックの外側** に押し出す設計とし、
  プロトコル中核(名前検証・メッセージ生成・スロット計算・QSO ステートマシン・ログ永続化)を単体テスト可能にする。

## 分類の定義

| 区分         | 記号      | 意味                                                                           | 実行方法                            |
| ------------ | --------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| 自動(単体)   | `UNIT`    | 純関数 / ステートマシン / LocalStorage で完結。CI で毎回実行                   | `pnpm test` (Vitest, jsdom)         |
| 自動(e2e)    | `E2E`     | 実ブラウザで起動〜描画を確認。フェイクメディアデバイスで権限自動付与           | `pnpm test:e2e` (Playwright)        |
| ハーネス必要 | `HARNESS` | 事前生成した音声フィクスチャや WASM の同梱が前提。治具が揃えば自動化可能       | Vitest + `.wav` / WASM              |
| 手動         | `MANUAL`  | 実機・実デバイス・複数端末・音響結合など、当日運用や実機確認でしか担保できない | 当日リハーサル / 実機チェックリスト |

> 1 つの AC が複数区分にまたがる場合、主たる自動検証を太字で示し、補完する手動確認を併記する。

## 分類サマリ

| AC-ID | 内容(要約)                                | 区分                     | 検証方法 / テスト配置                                                                  |
| ----- | ----------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| AC-1  | 起動時に名前ダイアログ+注意文             | **E2E**                  | `test/e2e/boot.spec.ts`: ダイアログと3種の注意文(録音/スピーカー/非送信)を assert      |
| AC-2  | 名前バリデーション(大文字英数字3文字)     | **UNIT**                 | `test/unit/name.test.ts`: `validateName` の正常/異常系                                 |
| AC-3  | 「開始」でAudioContext確立+マイク許可要求 | E2E + MANUAL             | E2E: 開始押下で `getUserMedia` が呼ばれることをフックで確認 / 実機で許可ダイアログ目視 |
| AC-4  | 許可承認で受信モード遷移                  | **E2E**                  | `boot.spec.ts`: フェイクデバイスで承認→メイン画面要素の出現                            |
| AC-5  | 許可拒否時の表示                          | **E2E**                  | Playwright で権限拒否をエミュレートし警告表示を assert                                 |
| AC-6  | 運用中の名前変更(3文字検証)               | UNIT + E2E               | UNIT: `validateName` 再利用 / E2E: 設定変更 UI の反映                                  |
| AC-7  | 15秒スロット同期(±500ms)                  | **UNIT**                 | `test/unit/slot.test.ts`: 境界からの送信開始遅延が ±500ms 以内                         |
| AC-8  | CQ送出はEVEN(:00/:30)                     | **UNIT**                 | `slot.test.ts` + `qso.test.ts`: 送信要求が EVEN パリティで発火                         |
| AC-9  | 応答はODD(:15/:45)                        | **UNIT**                 | `slot.test.ts` + `qso.test.ts`: 応答が ODD パリティで発火                              |
| AC-10 | 起動時ランダムオフセット                  | **UNIT**                 | `test/unit/offset.test.ts`: `chooseOffset(rng)` が候補内・分解能整合                   |
| AC-11 | デコード結果のテキスト表示                | **HARNESS**(緑) + MANUAL | `test/unit/ft8-roundtrip.test.ts` 往復テスト緑(WASM 同梱済)+ 実機音響結合は手動        |
| AC-12 | Start SequenceでCQ再生                    | **UNIT** + MANUAL        | `qso.test.ts`: `start_sequence`→次EVENで `CQ DE me` 送信アクション / 実音再生は手動    |
| AC-13 | CQ送出時のUI更新                          | UNIT + E2E               | UNIT: 状態が `cq_calling` へ遷移 / E2E: 状態表示の更新                                 |
| AC-14 | 自局CQの3回再送                           | **UNIT**                 | `qso.test.ts`: 応答無しで最大3回まで CQ 再送                                           |
| AC-15 | 再送後の待機遷移                          | **UNIT**                 | `qso.test.ts`: 3回再送後 `idle` へ                                                     |
| AC-16 | 他局CQへの応答開始                        | **UNIT**                 | `qso.test.ts`: `CQ DE A` デコードで応答シーケンス開始                                  |
| AC-17 | 既ログ局のCQ無視                          | **UNIT**                 | `qso.test.ts` + `log.test.ts`: `isKnown(A)` が真なら無視                               |
| AC-18 | 複数応答はサブバンド周波数最小            | **UNIT**                 | `qso.test.ts`: 複数応答を offset 昇順で選択                                            |
| AC-19 | 応答シーケンスの3回再送                   | **UNIT**                 | `qso.test.ts`: 返信無しで直前メッセージを最大3回再送                                   |
| AC-20 | 再送後の待機                              | **UNIT**                 | `qso.test.ts`: 3回再送後は待機                                                         |
| AC-21 | 完了時にログ保存                          | **UNIT**                 | `qso.test.ts`(`completed` アクション)+ `log.test.ts`(永続化)                           |
| AC-22 | ログ一覧UI                                | UNIT + E2E               | UNIT: `store.list()` 順序 / E2E: 一覧描画                                              |
| AC-23 | ログ削除                                  | **UNIT**                 | `log.test.ts`: `remove(name)` で LocalStorage から消える                               |
| AC-24 | 起動〜メイン画面描画(空き箱防止)          | **E2E**                  | `test/e2e/boot.spec.ts`: 名前確定→開始→許可→`Start Sequence`とログ一覧の描画           |
| AC-25 | 全送信メッセージ13文字以内                | **UNIT**                 | `test/unit/message.test.ts`: 全生成メッセージが ≤13(境界 `XXX DE YYY 73`=13)           |
| AC-26 | 応答局の初回送信 `相手 DE 自分`           | **UNIT**                 | `qso.test.ts`: 次ODDで `A DE me`                                                       |
| AC-27 | CQ発信局の73送信                          | **UNIT**                 | `qso.test.ts`: 応答受信→次EVENで `A DE me 73`                                          |
| AC-28 | 応答局の73送信                            | **UNIT**                 | `qso.test.ts`: 相手73受信→次ODDで `A DE me 73`                                         |
| AC-29 | 双方73でシーケンス完了                    | **UNIT**                 | `qso.test.ts`: 双方73で `completed`                                                    |
| AC-30 | time.isリンク表示                         | **E2E**                  | `boot.spec.ts`: `time.is` への外部リンク存在を assert                                  |
| AC-31 | 交信人数(N人)表示                         | UNIT + E2E               | UNIT: `store.count()` / E2E: 人数表示の反映                                            |
| AC-32 | 音声の非永続化                            | MANUAL + レビュー        | コードレビューで保存/送信経路が無いことを確認 + 実機で通信発生なしを目視               |

## 区分ごとの内訳

- **UNIT(自動・単体, Vitest)**: AC-2, 7, 8, 9, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 25, 26, 27, 28, 29(+6,13,22,31 の一部)
- **E2E(自動・Playwright)**: AC-1, 4, 5, 24, 30(+3,13,22,31 の UI 部分)
- **HARNESS(治具が要る自動化)**: AC-11(FT8 エンコード↔デコード往復 + ゴールデン音声)。ft8_lib 由来 WASM の同梱が前提。
- **MANUAL(手動・当日運用)**: AC-3/5 の実機許可ダイアログ挙動、AC-11 の実機音響結合デコード、AC-32 の非送信確認、
  および SPEC 1章「参加者の半数以上が1回交信成立」という運用上の成功条件。

## ハーネス(AC-11)の段取り

SPEC 6章に従い、AC-11 を治具で自動化する。**ft8_lib 由来 WASM を同梱済み**で、
`test/unit/ft8-roundtrip.test.ts` の往復テストは有効(緑)。

1. **エンコード↔デコード往復**(自動・緑): `encode("CQ DE ABC")` の音声サンプルを `decode()` に通し、元テキストが復元されること。周波数も復元され AC-18 に使える。
2. **ゴールデン音声**(任意): 事前生成した `.wav`(`test/fixtures/*.wav`)のデコード一致。往復テストで実質担保されるため優先度低。
3. **実機音響結合**(手動): 端末間でスピーカ→マイク経由のデコードは当日リハーサルで確認。

WASM は encode/decode の両方をエクスポート(`scripts/build-ft8-wasm.sh` で Docker + emscripten により再生成可能。ft8_lib は MIT)。

インターフェース境界(`src/audio/ft8.ts`、非同期):

```ts
export function encode(text: string, offsetHz: number): Promise<Float32Array> // 15秒スロットの音声
export function decode(samples: Float32Array): Promise<{ text: string; offsetHz: number }[]>
```

## 手動テスト・チェックリスト(当日リハーサル用)

- [ ] AC-3/AC-5: 実機(iOS Safari / Android Chrome)でマイク許可ダイアログが出る。拒否時に送受信不可の表示が出る。
- [ ] AC-11: 端末2台を並べ、片方の CQ をもう片方がデコードしてテキスト表示する(音響結合)。
- [ ] AC-32: 交信中に外部通信(ネットワーク)が発生していないこと(DevTools / プロキシで確認)。
- [ ] 時刻同期: 端末時計が time.is とずれていないこと。ずれていたらデコード不良を確認しリロード運用。
- [ ] 成功条件: リハーサルで参加者役の半数以上が1回以上交信成立できるか。

## トレーサビリティ(テスト実装状況)

自動化対象の各 AC はテストファイル内で `AC-XX` を記述し、grep 可能にする。
実装が進むにつれ SPEC 9章のトレーサビリティ表(現在すべて「未実装」)を更新する。
