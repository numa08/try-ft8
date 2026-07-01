import { describe, it, expect } from 'vitest'
import {
  SLOT_MS,
  SEND_TOLERANCE_MS,
  slotIndexAt,
  slotParityAt,
  nextSlotStart,
  nextSlotStartOfParity,
  msUntilNextSlot,
  isWithinSendTolerance,
} from '../../src/domain/slot'

// epoch 0 = スロット0(:00 相当・even)。以降 15s ごとに odd/even が交互。
describe('slot timing (AC-7, AC-8, AC-9)', () => {
  it('定数が仕様どおり', () => {
    expect(SLOT_MS).toBe(15_000)
    expect(SEND_TOLERANCE_MS).toBe(500)
  })

  it('スロット通番は 15 秒ごと', () => {
    expect(slotIndexAt(0)).toBe(0)
    expect(slotIndexAt(14_999)).toBe(0)
    expect(slotIndexAt(15_000)).toBe(1)
    expect(slotIndexAt(30_000)).toBe(2)
  })

  it('EVEN=:00/:30, ODD=:15/:45(AC-8 / AC-9)', () => {
    expect(slotParityAt(0)).toBe('even')
    expect(slotParityAt(7_500)).toBe('even')
    expect(slotParityAt(15_000)).toBe('odd')
    expect(slotParityAt(30_000)).toBe('even')
    expect(slotParityAt(45_000)).toBe('odd')
  })

  it('次スロット境界を返す', () => {
    expect(nextSlotStart(0)).toBe(15_000)
    expect(nextSlotStart(7_500)).toBe(15_000)
    expect(nextSlotStart(15_000)).toBe(30_000)
    expect(msUntilNextSlot(14_600)).toBe(400)
  })

  it('指定パリティの次スロット境界を返す', () => {
    expect(nextSlotStartOfParity(0, 'odd')).toBe(15_000)
    expect(nextSlotStartOfParity(0, 'even')).toBe(30_000)
    expect(nextSlotStartOfParity(16_000, 'even')).toBe(30_000)
    expect(nextSlotStartOfParity(16_000, 'odd')).toBe(45_000)
  })

  // AC-7: スロット境界から ±500ms 以内に送信を開始する。
  it('±500ms の送信許容窓を判定する(AC-7)', () => {
    expect(isWithinSendTolerance(0)).toBe(true)
    expect(isWithinSendTolerance(500)).toBe(true)
    expect(isWithinSendTolerance(501)).toBe(false)
    expect(isWithinSendTolerance(14_600)).toBe(true) // 境界 15000 まで 400ms
    expect(isWithinSendTolerance(14_000)).toBe(false) // 1000ms ずれ
  })
})
