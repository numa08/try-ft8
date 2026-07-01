# 音声フィクスチャ (AC-11 ハーネス)

AC-11(FT8 デコード)のゴールデンテストに用いる、事前生成した既知の `.wav` を置く。

- 命名: `<期待デコードテキストをアンダースコア化>.wav`(例: `CQ_DE_ABC.wav`)
- サンプリング: 12kHz モノラル(`src/audio/ft8.ts` の `SAMPLE_RATE` と一致させる)
- 生成方法: WASM 同梱後、`encode()` の出力を WAV 化して固定するか、WSJT-X 等で生成した参照音声を用いる。

WASM(ft8_lib 由来)同梱までは `test/unit/ft8-roundtrip.test.ts` を skip とし、
フィクスチャが揃い次第 skip を外して有効化する。
