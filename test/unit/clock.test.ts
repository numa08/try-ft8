import { describe, it, expect } from 'vitest'
import { parseHttpDateMs, estimateSecondBoundary, createClock } from '../../src/domain/clock'
import type { DateSample } from '../../src/domain/clock'

// AC-34 / AC-7: Date ヘッダ秒境界検出 + performance.now 基準の補正クロック。
describe('parseHttpDateMs', () => {
  it('RFC1123 の Date を epoch(ms)へ(秒単位)', () => {
    expect(parseHttpDateMs('Thu, 01 Jan 1970 00:00:01 GMT')).toBe(1000)
    expect(parseHttpDateMs('Wed, 21 Oct 2015 07:28:00 GMT')).toBe(1445412480000)
  })

  it('パース不能や null は null', () => {
    expect(parseHttpDateMs('nonsense')).toBeNull()
    expect(parseHttpDateMs(null)).toBeNull()
  })
})

describe('estimateSecondBoundary (AC-34)', () => {
  it('秒がインクリメントした遷移を検出し中点で境界を推定する', () => {
    const samples: DateSample[] = [
      { perfSent: 0, perfRecv: 20, dateMs: 5000 }, // stamp 10
      { perfSent: 50, perfRecv: 70, dateMs: 5000 }, // stamp 60
      { perfSent: 100, perfRecv: 120, dateMs: 6000 }, // stamp 110 ← ここで 5000→6000
    ]
    // 境界 perf = (60 + 110) / 2 = 85、epoch = 6000
    expect(estimateSecondBoundary(samples)).toEqual({ epochMs: 6000, perfMs: 85 })
  })

  it('秒境界が観測できなければ null', () => {
    const samples: DateSample[] = [
      { perfSent: 0, perfRecv: 20, dateMs: 5000 },
      { perfSent: 50, perfRecv: 70, dateMs: 5000 },
    ]
    expect(estimateSecondBoundary(samples)).toBeNull()
    expect(estimateSecondBoundary([])).toBeNull()
  })
})

describe('createClock (AC-7 / AC-30)', () => {
  it('未同期では端末時計をそのまま返しオフセット 0', () => {
    let perf = 100
    let device = 4000
    const clock = createClock(
      () => perf,
      () => device,
    )
    expect(clock.synced).toBe(false)
    expect(clock.now()).toBe(4000)
    expect(clock.offsetMs()).toBe(0)
    perf = 200
    device = 4100
    expect(clock.now()).toBe(4100)
  })

  it('アンカー適用後は performance.now 基準で補正時刻を返す', () => {
    let perf = 185
    const device = 4000
    const clock = createClock(
      () => perf,
      () => device,
    )
    clock.apply({ epochMs: 6000, perfMs: 85 })
    expect(clock.synced).toBe(true)
    // now = 6000 + (185 - 85) = 6100
    expect(clock.now()).toBe(6100)
    // 表示オフセット = 補正時刻 - 端末時計 = 6100 - 4000 = 2100
    expect(clock.offsetMs()).toBe(2100)
    perf = 285
    // now = 6000 + (285 - 85) = 6200(単調増加)
    expect(clock.now()).toBe(6200)
  })
})
