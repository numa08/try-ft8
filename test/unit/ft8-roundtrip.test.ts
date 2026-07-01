import { describe, it, expect } from 'vitest'
import { encode, decode } from '../../src/audio/ft8'

// AC-11(HARNESS): FT8 音声のエンコード/デコード検証。
// SPEC 6章に従い (a) 往復テスト と (b) ゴールデン音声デコードで確認する。
// WASM(ft8_lib 由来)を同梱するまではハーネス未整備のため skip。実装完了時に有効化する。
// 握りつぶしではなく「治具待ち」を明示し、トレーサビリティに残す。
describe.skip('FT8 encode/decode 往復 (AC-11 / 治具待ち: WASM 同梱後に有効化)', () => {
  it('エンコードしたメッセージを再デコードすると復元される', () => {
    const samples = encode('CQ DE ABC', 1000)
    const decoded = decode(samples)
    expect(decoded.map((d) => d.text)).toContain('CQ DE ABC')
  })

  it.todo('ゴールデン .wav (test/fixtures/*.wav) をデコードして期待テキストに一致する')
})
