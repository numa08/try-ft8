/**
 * AC-34 / AC-7: 同一オリジンへの HEAD の `Date` ヘッダ(秒単位)から秒境界を検出し、
 * `performance.now()`(単調増加)を基準に補正時刻を求めるクロック。
 * OS の時計は変更しない。Cloudflare 経由では `Date` はエッジ(NTP同期)時刻になる。
 */

/** 1 回の Date サンプル。perf は performance.now() の値(ms)。 */
export interface DateSample {
  /** 要求送信直前の performance.now()。 */
  perfSent: number
  /** 応答受信時の performance.now()。 */
  perfRecv: number
  /** `Date` ヘッダをパースした秒境界の epoch(ms, 秒単位=下3桁0)。 */
  dateMs: number
}

/** 秒境界アンカー:真時刻 epochMs のとき performance.now() が perfMs だった、という基準点。 */
export interface ClockAnchor {
  epochMs: number
  perfMs: number
}

/** `Date` ヘッダ文字列を epoch(ms)へ。パース不能なら null。 */
export function parseHttpDateMs(header: string | null): number | null {
  if (header === null) {
    return null
  }
  const ms = Date.parse(header)
  return Number.isNaN(ms) ? null : ms
}

/**
 * 連続サンプルから「秒がインクリメントした瞬間」を検出してアンカーを推定する。
 * 各サンプルのサーバ時刻は送受信の中点で近似し、境界はその中点どうしの中点で推定する。
 * 秒境界が観測できなければ null。
 */
export function estimateSecondBoundary(samples: DateSample[]): ClockAnchor | null {
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]
    const cur = samples[i]
    if (cur.dateMs > prev.dateMs) {
      const stampPrev = (prev.perfSent + prev.perfRecv) / 2
      const stampCur = (cur.perfSent + cur.perfRecv) / 2
      return { epochMs: cur.dateMs, perfMs: (stampPrev + stampCur) / 2 }
    }
  }
  return null
}

export interface Clock {
  /** アンカー適用済みか(未同期なら false)。 */
  readonly synced: boolean
  /** 補正時刻(真時刻の推定, ms)。未同期なら端末時計。 */
  now(): number
  /** 端末時計に対する適用オフセット(ms, 表示用)。未同期なら 0。 */
  offsetMs(): number
  /** 秒境界アンカーを適用する(AC-34)。 */
  apply(anchor: ClockAnchor): void
}

/**
 * 補正クロックを生成する。perfNow 未指定時は performance.now、deviceNow 未指定時は Date.now。
 */
export function createClock(
  perfNow: () => number = () => performance.now(),
  deviceNow: () => number = () => Date.now(),
): Clock {
  let anchor: ClockAnchor | null = null
  return {
    get synced() {
      return anchor !== null
    },
    now() {
      return anchor === null ? deviceNow() : anchor.epochMs + (perfNow() - anchor.perfMs)
    },
    offsetMs() {
      return anchor === null ? 0 : anchor.epochMs + (perfNow() - anchor.perfMs) - deviceNow()
    },
    apply(next) {
      anchor = next
    },
  }
}
