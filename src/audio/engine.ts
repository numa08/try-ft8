import { FT8_READY, SAMPLE_RATE, decode, encode } from './ft8'
import type { DecodedMessage } from './ft8'

export type AudioEngineStatus = 'idle' | 'ready' | 'denied' | 'unsupported'

export interface AudioEngine {
  readonly status: AudioEngineStatus
  /** FT8 の送受信(WASM)が利用可能か。 */
  readonly ft8Ready: boolean
  /** AC-3: ユーザージェスチャで AudioContext を確立し、マイク利用許可を要求する。 */
  init(): Promise<void>
  /** テキストを FT8 音声にエンコードして再生する。 */
  transmit(text: string, offsetHz: number): Promise<void>
  /** 直近スロット分のマイク音声を 12kHz にリサンプルしてデコードする(未準備なら空)。 */
  decodeRecentAudio(): Promise<DecodedMessage[]>
  close(): void
}

/** デコード対象として切り出す直近秒数(FT8 スロット長)。 */
const CAPTURE_SECONDS = 15
/** リングバッファの確保秒数(スロット長に少し余裕)。 */
const RING_SECONDS = 16
/** デコードを試みる最小蓄積秒数。 */
const MIN_DECODE_SECONDS = 4

type AudioContextCtor = typeof AudioContext
type OfflineAudioContextCtor = typeof OfflineAudioContext

function resolveAudioContextCtor(): AudioContextCtor | null {
  const w = window as typeof window & { webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function resolveOfflineCtor(): OfflineAudioContextCtor | null {
  const w = window as typeof window & { webkitOfflineAudioContext?: OfflineAudioContextCtor }
  return w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null
}

/**
 * Web Audio の境界。AudioContext・マイクストリームの確立、送信音声の再生、
 * 受信音声の取り込み(リングバッファ)と 12kHz リサンプルを担う。
 * 実際の FT8 変換(WASM)は ft8.ts に委譲し、プロトコル中核(qso.ts)は純ロジックに保つ。
 */
export function createAudioEngine(): AudioEngine {
  let status: AudioEngineStatus = 'idle'
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  let sink: GainNode | null = null

  // マイク音声を貯める円環バッファ(context.sampleRate のサンプル)。
  let ring: Float32Array | null = null
  let ringPos = 0
  let ringFilled = 0

  function writeRing(input: Float32Array): void {
    if (!ring) return
    const capacity = ring.length
    for (let i = 0; i < input.length; i++) {
      ring[ringPos] = input[i]
      ringPos = (ringPos + 1) % capacity
    }
    ringFilled = Math.min(capacity, ringFilled + input.length)
  }

  function snapshotRecent(rate: number): Float32Array | null {
    if (!ring) return null
    const want = Math.min(ringFilled, CAPTURE_SECONDS * rate)
    if (want < MIN_DECODE_SECONDS * rate) return null
    const out = new Float32Array(want)
    const start = (ringPos - want + ring.length * 2) % ring.length
    for (let i = 0; i < want; i++) {
      out[i] = ring[(start + i) % ring.length]
    }
    return out
  }

  async function resampleTo12k(samples: Float32Array, rate: number): Promise<Float32Array> {
    if (rate === SAMPLE_RATE) return samples
    const OfflineCtor = resolveOfflineCtor()
    if (!OfflineCtor) return samples
    // OfflineAudioContext がバッファのサンプルレートを出力レート(12kHz)へアンチエイリアス付きで変換する。
    const targetLength = Math.max(1, Math.round((samples.length * SAMPLE_RATE) / rate))
    const offline = new OfflineCtor(1, targetLength, SAMPLE_RATE)
    const buffer = offline.createBuffer(1, samples.length, rate)
    buffer.copyToChannel(Float32Array.from(samples), 0)
    const bufferSource = offline.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.connect(offline.destination)
    bufferSource.start()
    const rendered = await offline.startRendering()
    return rendered.getChannelData(0)
  }

  async function init(): Promise<void> {
    const Ctor = resolveAudioContextCtor()
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      status = 'unsupported'
      throw new Error('この端末は Web Audio / マイク入力に対応していません')
    }
    context = new Ctor()
    // 自動応答(73 等)の送信を可能にするため、ユーザージェスチャで resume して以後維持する。
    await context.resume()
    try {
      // FT8 は狭帯域トーンのため、エコー除去・ノイズ抑制・自動ゲインは無効化して原音を得る。
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (cause) {
      status = 'denied' // AC-5
      throw new Error('マイクの利用が許可されなかったため送受信できません', { cause })
    }

    const rate = context.sampleRate
    ring = new Float32Array(Math.ceil(RING_SECONDS * rate))
    ringPos = 0
    ringFilled = 0

    source = context.createMediaStreamSource(stream)
    processor = context.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      writeRing(event.inputBuffer.getChannelData(0))
    }
    // ScriptProcessor は出力に繋がないと駆動されないため、無音ゲイン経由で destination へ繋ぐ
    // (マイク音をスピーカーに戻さずハウリングを防ぐ)。
    sink = context.createGain()
    sink.gain.value = 0
    source.connect(processor)
    processor.connect(sink)
    sink.connect(context.destination)

    status = 'ready'
  }

  async function transmit(text: string, offsetHz: number): Promise<void> {
    if (!FT8_READY || !context) {
      return
    }
    const samples = await encode(text, offsetHz)
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE)
    // AudioBuffer は専有 ArrayBuffer 由来の Float32Array を要求するためコピーして渡す。
    buffer.copyToChannel(Float32Array.from(samples), 0)
    const bufferSource = context.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.connect(context.destination)
    bufferSource.start()
  }

  async function decodeRecentAudio(): Promise<DecodedMessage[]> {
    if (!FT8_READY || status !== 'ready' || !context) {
      return []
    }
    const rate = context.sampleRate
    const snapshot = snapshotRecent(rate)
    if (!snapshot) {
      return []
    }
    const samples = await resampleTo12k(snapshot, rate)
    return decode(samples)
  }

  function close(): void {
    processor?.disconnect()
    source?.disconnect()
    sink?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    void context?.close()
    processor = null
    source = null
    sink = null
    stream = null
    context = null
    ring = null
    status = 'idle'
  }

  return {
    get status() {
      return status
    },
    get ft8Ready() {
      return FT8_READY
    },
    init,
    transmit,
    decodeRecentAudio,
    close,
  }
}
