/**
 * OQ-4 の決定(実装時チューニング対象): サブバンドの音声オフセット範囲と分解能。
 * スマホのスピーカ/マイクの実用帯域に収め、AC-10(ランダム選択)・AC-18(最小周波数へ応答)が
 * 一意に順序づけできるよう離散化する。
 */
export const OFFSET_MIN_HZ = 500
export const OFFSET_MAX_HZ = 2000
export const OFFSET_STEP_HZ = 100

/** 選択可能なオフセット候補(昇順、いずれも STEP の倍数)。 */
export function offsetCandidates(): number[] {
  const candidates: number[] = []
  for (let hz = OFFSET_MIN_HZ; hz <= OFFSET_MAX_HZ; hz += OFFSET_STEP_HZ) {
    candidates.push(hz)
  }
  return candidates
}

/** AC-10: 起動時に候補からランダムに 1 つ選ぶ。rng は [0,1) を返す注入可能な乱数源。 */
export function chooseOffset(rng: () => number = Math.random): number {
  const candidates = offsetCandidates()
  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
  return candidates[index]
}
