import createFt8 from './wasm/ft8.mjs'
import type { Ft8Module, Ft8ModuleOptions } from './wasm/ft8.mjs'

/**
 * FT8 フリーテキストのエンコード/デコード境界(ft8_lib 由来 WASM ラッパ)。
 * 音声サンプル ↔ テキストの純変換として扱い、Web Audio との結線は engine.ts が行う。
 * WASM は encode(テキスト→音声)と decode(音声→テキスト+周波数)の両方をエクスポートする。
 * ビルドは scripts/build-ft8-wasm.sh(Docker + emscripten)。
 */

/** サンプリング周波数(FT8 標準)。 */
export const SAMPLE_RATE = 12_000

/** ft8_lib WASM 同梱済み。encode/decode が利用可能。 */
export const FT8_READY = true

export interface DecodedMessage {
  text: string
  /** サブバンド音声周波数(Hz)。AC-18 の最小周波数選択に使う。 */
  offsetHz: number
}

/** デコード結果テキストの上限バイト数。 */
const OUT_TEXT_CAP = 8192
/** 15 秒スロット(180,000）に余裕を持たせた最大サンプル数。 */
const MAX_SAMPLES = 16 * SAMPLE_RATE

let modulePromise: Promise<Ft8Module> | null = null

function loadModule(): Promise<Ft8Module> {
  if (modulePromise === null) {
    modulePromise = (async () => {
      const options: Ft8ModuleOptions = { printErr: () => {} }
      // 実ブラウザでは Vite が配信する .wasm の URL を Emscripten に教える。
      // Node(vitest)では ft8.mjs が import.meta.url から隣接 .wasm を読むため不要。
      if (typeof window !== 'undefined') {
        const wasmUrl = (await import('./wasm/ft8.wasm?url')).default
        options.locateFile = (path) => (path.endsWith('.wasm') ? wasmUrl : path)
      }
      return createFt8(options)
    })()
  }
  return modulePromise
}

/** テキストを 15 秒スロットのモノラル音声サンプルにエンコードする。 */
export async function encode(text: string, offsetHz: number): Promise<Float32Array> {
  const m = await loadModule()
  const pOut = m._malloc(MAX_SAMPLES * 4)
  try {
    const count = m.ccall(
      'ft8_encode_samples',
      'number',
      ['string', 'number', 'number', 'number', 'number'],
      [text, offsetHz, SAMPLE_RATE, pOut, MAX_SAMPLES],
    ) as number
    if (count <= 0) {
      throw new Error(`ft8_encode_samples failed (rc=${count}) for "${text}"`)
    }
    // メモリ成長で HEAPF32 が無効化されうるため、確保後に都度参照してコピーを返す。
    return m.HEAPF32.slice(pOut >> 2, (pOut >> 2) + count)
  } finally {
    m._free(pOut)
  }
}

/** 音声サンプルをデコードし、検出できたメッセージ(テキスト+周波数)を返す。 */
export async function decode(samples: Float32Array): Promise<DecodedMessage[]> {
  const m = await loadModule()
  const n = samples.length
  const pSig = m._malloc(n * 4)
  const pOut = m._malloc(OUT_TEXT_CAP)
  try {
    m.HEAPF32.set(samples, pSig >> 2)
    m.ccall(
      'ft8_decode_samples',
      'number',
      ['number', 'number', 'number', 'number', 'number'],
      [pSig, n, SAMPLE_RATE, pOut, OUT_TEXT_CAP],
    )
    // 各行 = "snr\tfreq_hz\tmessage"。
    return m
      .UTF8ToString(pOut)
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split('\t')
        const text = parts[parts.length - 1]
        const offsetHz = parts.length >= 3 ? Number.parseFloat(parts[1]) : 0
        return { text, offsetHz }
      })
  } finally {
    m._free(pSig)
    m._free(pOut)
  }
}
