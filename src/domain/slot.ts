import { notImplemented } from '../util/notImplemented'

/** AC-7: 15 秒スロット(:00 / :15 / :30 / :45)。 */
export const SLOT_MS = 15_000

/** AC-7: スロット境界からの送信開始許容ずれ。 */
export const SEND_TOLERANCE_MS = 500

/** EVEN = :00 / :30(AC-8 CQ送出)、ODD = :15 / :45(AC-9 応答)。 */
export type SlotParity = 'even' | 'odd'

/** epoch(ms)が属するスロット通番。 */
export function slotIndexAt(epochMs: number): number {
  return notImplemented('slotIndexAt', epochMs)
}

/** epoch(ms)のスロットパリティ。境界 :00/:30 が even。 */
export function slotParityAt(epochMs: number): SlotParity {
  return notImplemented('slotParityAt', epochMs)
}

/** 次のスロット境界の epoch(ms)。 */
export function nextSlotStart(epochMs: number): number {
  return notImplemented('nextSlotStart', epochMs)
}

/** 指定パリティで次に到来するスロット境界の epoch(ms)。 */
export function nextSlotStartOfParity(epochMs: number, parity: SlotParity): number {
  return notImplemented('nextSlotStartOfParity', epochMs, parity)
}

/** 次のスロット境界までの残り ms。 */
export function msUntilNextSlot(epochMs: number): number {
  return notImplemented('msUntilNextSlot', epochMs)
}

/** AC-7: 直近のスロット境界から ±500ms 以内か。 */
export function isWithinSendTolerance(epochMs: number): boolean {
  return notImplemented('isWithinSendTolerance', epochMs)
}
