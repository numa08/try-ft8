import { estimateSecondBoundary, parseHttpDateMs } from '../domain/clock'
import type { Clock, DateSample } from '../domain/clock'

export interface SyncOptions {
  /** 問い合わせ先(既定: 現在ページ, 同一オリジン)。 */
  url?: string
  /** サンプリング間隔(ms)。 */
  intervalMs?: number
  /** 秒境界を捕まえるまでの最大試行回数。 */
  maxAttempts?: number
  fetchFn?: typeof fetch
  perfNow?: () => number
  delayFn?: (ms: number) => Promise<void>
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * AC-34: 同一オリジンへ HEAD(キャッシュ回避)を短間隔で連投し、`Date` ヘッダの秒が
 * インクリメントした瞬間(秒境界)を検出して clock にアンカーを適用する。
 * 秒境界を捕まえられなければ false(端末時計にフォールバック)。
 * 副作用(fetch/タイマー)はこのモジュールに閉じ込め、算出ロジックは clock.ts の純関数に委譲する。
 */
export async function syncClock(clock: Clock, options: SyncOptions = {}): Promise<boolean> {
  const baseUrl = options.url ?? location.href
  const intervalMs = options.intervalMs ?? 45
  const maxAttempts = options.maxAttempts ?? 40
  const doFetch = options.fetchFn ?? fetch
  const perfNow = options.perfNow ?? (() => performance.now())
  const delay = options.delayFn ?? defaultDelay

  const samples: DateSample[] = []
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const perfSent = perfNow()
    let dateMs: number | null
    try {
      // キャッシュ回避: no-store + クエリバスターで必ず新鮮な Date を得る。
      const url = new URL(baseUrl)
      url.searchParams.set('_ts', String(attempt))
      const response = await doFetch(url.toString(), { method: 'HEAD', cache: 'no-store' })
      dateMs = parseHttpDateMs(response.headers.get('date'))
    } catch {
      dateMs = null
    }
    const perfRecv = perfNow()

    if (dateMs !== null) {
      samples.push({ perfSent, perfRecv, dateMs })
      const anchor = estimateSecondBoundary(samples)
      if (anchor !== null) {
        clock.apply(anchor)
        return true
      }
    }
    await delay(intervalMs)
  }
  return false
}
