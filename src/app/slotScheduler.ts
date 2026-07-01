import { msUntilNextSlot, slotParityAt } from '../domain/slot'
import type { SlotParity } from '../domain/slot'

export interface SlotScheduler {
  /** 次のスロット境界ごとに onSlot を発火し続ける。 */
  start(onSlot: (parity: SlotParity, epochMs: number) => void): void
  stop(): void
}

/**
 * 端末時計に基づき 15 秒スロット境界(:00/:15/:30/:45)で発火するスケジューラ。
 * 時刻補正はせず(SPEC 制約)、境界までの残り時間だけ setTimeout する。
 */
export function createSlotScheduler(now: () => number = () => Date.now()): SlotScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null

  function stop(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleNext(onSlot: (parity: SlotParity, epochMs: number) => void): void {
    timer = setTimeout(() => {
      const boundary = now()
      onSlot(slotParityAt(boundary), boundary)
      scheduleNext(onSlot)
    }, msUntilNextSlot(now()))
  }

  return {
    start(onSlot) {
      stop()
      scheduleNext(onSlot)
    },
    stop,
  }
}
