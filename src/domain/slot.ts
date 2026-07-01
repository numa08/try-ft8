/** AC-7: 15 秒スロット(:00 / :15 / :30 / :45)。 */
export const SLOT_MS = 15_000

/** AC-7: スロット境界からの送信開始許容ずれ。 */
export const SEND_TOLERANCE_MS = 500

/** EVEN = :00 / :30(AC-8 CQ送出)、ODD = :15 / :45(AC-9 応答)。 */
export type SlotParity = 'even' | 'odd'

/** epoch(ms)が属するスロット通番。 */
export function slotIndexAt(epochMs: number): number {
  return Math.floor(epochMs / SLOT_MS)
}

/** epoch(ms)のスロットパリティ。境界 :00/:30 が even。 */
export function slotParityAt(epochMs: number): SlotParity {
  return slotIndexAt(epochMs) % 2 === 0 ? 'even' : 'odd'
}

/** 次のスロット境界の epoch(ms)。 */
export function nextSlotStart(epochMs: number): number {
  return (Math.floor(epochMs / SLOT_MS) + 1) * SLOT_MS
}

/** 指定パリティで次に到来するスロット境界の epoch(ms)。 */
export function nextSlotStartOfParity(epochMs: number, parity: SlotParity): number {
  let boundary = nextSlotStart(epochMs)
  while (slotParityAt(boundary) !== parity) {
    boundary += SLOT_MS
  }
  return boundary
}

/** 次のスロット境界までの残り ms。 */
export function msUntilNextSlot(epochMs: number): number {
  return nextSlotStart(epochMs) - epochMs
}

/** AC-7: 直近のスロット境界から ±500ms 以内か。 */
export function isWithinSendTolerance(epochMs: number): boolean {
  const previous = Math.floor(epochMs / SLOT_MS) * SLOT_MS
  const next = previous + SLOT_MS
  return Math.min(epochMs - previous, next - epochMs) <= SEND_TOLERANCE_MS
}
