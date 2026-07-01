// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { encode, decode, FT8_READY, SAMPLE_RATE } from '../../src/audio/ft8'

// AC-11(HARNESS): FT8 音声のエンコード/デコード検証。
// ft8_lib 由来 WASM の encode↔decode 往復で送信テキストが復元されることを確認する(SPEC 6章)。
// WASM を Node で読み込むため @vitest-environment node を指定。
describe('FT8 encode/decode 往復 (AC-11)', () => {
  it('ft8_lib WASM が同梱されている', () => {
    expect(FT8_READY).toBe(true)
    expect(SAMPLE_RATE).toBe(12_000)
  })

  it('エンコードしたメッセージを再デコードすると復元される', async () => {
    const samples = await encode('CQ DE ABC', 1000)
    const decoded = await decode(samples)
    expect(decoded.map((d) => d.text)).toContain('CQ DE ABC')
  })

  it('QSO で使う各メッセージが往復する', async () => {
    for (const text of ['ABC DE XYZ', 'ABC DE XYZ 73', 'QQQ DE M8N']) {
      const decoded = await decode(await encode(text, 1500))
      expect(decoded.map((d) => d.text)).toContain(text)
    }
  })

  it('デコード結果に送信周波数が復元される (AC-18 用)', async () => {
    const decoded = await decode(await encode('CQ DE ABC', 700))
    const hit = decoded.find((d) => d.text === 'CQ DE ABC')
    expect(hit).toBeDefined()
    expect(hit?.offsetHz ?? 0).toBeGreaterThan(650)
    expect(hit?.offsetHz ?? 0).toBeLessThan(750)
  })
})
