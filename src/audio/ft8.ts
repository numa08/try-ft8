import { notImplemented } from '../util/notImplemented'

/**
 * FT8 フリーテキストのエンコード/デコード境界(WASM ラッパ)。
 * ft8_lib 由来の WASM を同梱して実装する。この関数群は音声サンプル ↔ テキストの純変換として扱い、
 * Web Audio との結線(マイク入力バッファの供給・スピーカ再生)は呼び出し側で行う。
 *
 * AC-11 の自動検証(治具): encode↔decode 往復 + ゴールデン .wav デコード。
 */

/** サンプリング周波数(FT8 標準)。 */
export const SAMPLE_RATE = 12_000

export interface DecodedMessage {
  text: string
  offsetHz: number
}

/** テキストを 15 秒スロットのモノラル音声サンプルにエンコードする。 */
export function encode(text: string, offsetHz: number): Float32Array {
  return notImplemented('encode', text, offsetHz)
}

/** 音声サンプルをデコードし、検出できたメッセージを返す。 */
export function decode(samples: Float32Array): DecodedMessage[] {
  return notImplemented('decode', samples)
}
