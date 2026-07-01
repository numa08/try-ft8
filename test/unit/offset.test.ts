import { describe, it, expect } from 'vitest'
import {
  OFFSET_MIN_HZ,
  OFFSET_MAX_HZ,
  OFFSET_STEP_HZ,
  offsetCandidates,
  chooseOffset,
} from '../../src/domain/offset'

// AC-10: 起動時にランダムな送信周波数オフセットを選択する。
// OQ-4: 範囲・分解能は offset.ts で確定(500〜2000Hz, 100Hz 刻み)。
describe('sub-band offset (AC-10, OQ-4)', () => {
  it('候補は範囲内・昇順・STEP の倍数', () => {
    const candidates = offsetCandidates()
    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates[0]).toBe(OFFSET_MIN_HZ)
    expect(candidates.at(-1)).toBe(OFFSET_MAX_HZ)
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i]).toBeGreaterThan(candidates[i - 1])
    }
    for (const hz of candidates) {
      expect(hz % OFFSET_STEP_HZ).toBe(0)
      expect(hz).toBeGreaterThanOrEqual(OFFSET_MIN_HZ)
      expect(hz).toBeLessThanOrEqual(OFFSET_MAX_HZ)
    }
  })

  it('rng を注入して決定的に選べる', () => {
    expect(chooseOffset(() => 0)).toBe(OFFSET_MIN_HZ)
    expect(chooseOffset(() => 0.999999)).toBe(OFFSET_MAX_HZ)
  })

  it('選ばれる値は必ず候補のいずれか', () => {
    const candidates = new Set(offsetCandidates())
    for (const r of [0, 0.1, 0.33, 0.5, 0.75, 0.9, 0.999999]) {
      expect(candidates.has(chooseOffset(() => r))).toBe(true)
    }
  })
})
