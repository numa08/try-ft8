import { callMessage, cqMessage, parseMessage, seventyThreeMessage } from './message'
import type { ParsedMessage } from './message'
import type { SlotParity } from './slot'

/**
 * 交互 QSO のプロトコル中核(純ステートマシン)。音声・時刻・DOM から切り離し、
 * 「デコード結果」と「スロット境界の到来」をイベントとして受け取り、送信/完了アクションを返す。
 *
 * 役割は自動決定(SPEC Non-Goals): 自分から CQ を出せば発信局(EVEN)、他局 CQ に応じれば応答局(ODD)。
 *
 * 発信局(Caller)の流れ: AC-12,13,14,15,18,27,29
 * 応答局(Responder)の流れ: AC-16,17,19,20,26,28,29
 */
export type QsoStateKind =
  | 'idle' // 待機・受信中
  | 'cq_calling' // CQ 送出し応答待ち(発信局・EVEN)
  | 'cq_answering' // 応答を受け 73 を送る(発信局・EVEN)
  | 'resp_replying' // CQ に応答し相手の 73 待ち(応答局・ODD)
  | 'resp_finishing' // 相手 73 を受け自局 73 を送る(応答局・ODD)
  | 'done'

export interface QsoState {
  kind: QsoStateKind
  /** 交信相手の名前(確定後)。 */
  peer?: string
  /** 現フェーズで直前メッセージを再送した回数(AC-14 / AC-19: 最大 3)。 */
  resends: number
}

export type QsoEvent =
  | { type: 'start_sequence' } // AC-12: ユーザーが Start Sequence
  | { type: 'decode'; text: string; offsetHz: number } // AC-11 経由の受信
  | { type: 'slot'; parity: SlotParity } // スロット境界の到来(送信機会)

export type QsoAction =
  | { type: 'transmit'; text: string } // このスロットで音声送信すべきメッセージ
  | { type: 'completed'; peer: string } // AC-29: シーケンス完了 → ログ保存へ
  | { type: 'waiting' } // AC-15 / AC-20: 待機へ遷移

export interface QsoConfig {
  /** 自局の名前(3文字)。 */
  me: string
  /** AC-17: 既に交信済みの相手か。ログストアの has を渡す。 */
  isKnown: (name: string) => boolean
  /** AC-14 / AC-19: 最大再送回数。既定 3。 */
  maxResends?: number
}

export interface QsoMachine {
  readonly state: QsoState
  /** イベントを適用し、副作用(送信/完了/待機)をアクション列として返す純関数的 API。 */
  dispatch(event: QsoEvent): QsoAction[]
}

interface Answer {
  from: string
  offsetHz: number
}

export function createQsoMachine(config: QsoConfig): QsoMachine {
  const me = config.me
  const maxResends = config.maxResends ?? 3

  let state: QsoState = { kind: 'idle', resends: 0 }
  // 現フェーズで送信した回数。初回 + maxResends 回まで送り、それを超えたら待機へ。
  let phaseTx = 0
  // AC-18: 自局 CQ への複数応答を集め、次の送信機会に最小オフセット局を選ぶ。
  let answers: Answer[] = []

  function makeState(kind: QsoStateKind, peer?: string): QsoState {
    const resends = Math.max(0, phaseTx - 1)
    return peer === undefined ? { kind, resends } : { kind, peer, resends }
  }

  function addressedToMe(msg: ParsedMessage): boolean {
    return !msg.isCq && msg.to === me
  }

  function handleDecode(msg: ParsedMessage, offsetHz: number): QsoAction[] {
    switch (state.kind) {
      case 'idle':
        // AC-16 / AC-17: 他局 CQ に応答開始。ただし既交信の相手は無視。
        if (msg.isCq && !config.isKnown(msg.from)) {
          phaseTx = 0
          state = makeState('resp_replying', msg.from)
        }
        return []
      case 'cq_calling':
        // AC-18: 自局 CQ への応答 `me DE X` を集める。
        if (addressedToMe(msg) && !msg.is73) {
          answers.push({ from: msg.from, offsetHz })
        }
        return []
      case 'cq_answering':
        // AC-29: 相手の `me DE peer 73` を受信 → 双方 73 で完了。
        if (addressedToMe(msg) && msg.is73 && msg.from === state.peer) {
          const peer = msg.from
          state = { kind: 'done', peer, resends: 0 }
          return [{ type: 'completed', peer }]
        }
        return []
      case 'resp_replying':
        // AC-28: 相手(発信局)の `me DE peer 73` を受信 → 次 ODD で自局 73。
        if (addressedToMe(msg) && msg.is73 && msg.from === state.peer) {
          phaseTx = 0
          state = makeState('resp_finishing', state.peer)
        }
        return []
      default:
        return []
    }
  }

  function giveUp(): QsoAction[] {
    phaseTx = 0
    answers = []
    state = makeState('idle')
    return [{ type: 'waiting' }]
  }

  function handleSlot(parity: SlotParity): QsoAction[] {
    switch (state.kind) {
      case 'cq_calling': {
        if (parity !== 'even') return [] // AC-8: CQ は EVEN のみ
        if (answers.length > 0) {
          // AC-18: 最小オフセットの応答局にのみ応答し、AC-27: 73 を送る。
          const chosen = answers.reduce((lowest, a) => (a.offsetHz < lowest.offsetHz ? a : lowest))
          answers = []
          phaseTx = 1
          state = makeState('cq_answering', chosen.from)
          return [{ type: 'transmit', text: seventyThreeMessage(chosen.from, me) }]
        }
        // AC-14 / AC-15: 応答無しなら最大 3 回 CQ 再送、その後待機。
        if (phaseTx <= maxResends) {
          phaseTx++
          state = makeState('cq_calling')
          return [{ type: 'transmit', text: cqMessage(me) }]
        }
        return giveUp()
      }
      case 'cq_answering': {
        if (parity !== 'even') return []
        const peer = state.peer
        if (peer !== undefined && phaseTx <= maxResends) {
          phaseTx++
          return [{ type: 'transmit', text: seventyThreeMessage(peer, me) }]
        }
        return giveUp()
      }
      case 'resp_replying': {
        if (parity !== 'odd') return [] // AC-9: 応答は ODD のみ
        const peer = state.peer
        // AC-26 / AC-19 / AC-20: 初回 `peer DE me`、返信無しは最大 3 回再送、その後待機。
        if (peer !== undefined && phaseTx <= maxResends) {
          phaseTx++
          return [{ type: 'transmit', text: callMessage(peer, me) }]
        }
        return giveUp()
      }
      case 'resp_finishing': {
        if (parity !== 'odd') return []
        const peer = state.peer
        if (peer === undefined) return giveUp()
        // AC-28 / AC-29: 自局 73 を送出 → 双方 73 で完了。
        state = { kind: 'done', peer, resends: 0 }
        return [
          { type: 'transmit', text: seventyThreeMessage(peer, me) },
          { type: 'completed', peer },
        ]
      }
      default:
        return []
    }
  }

  return {
    get state() {
      return state
    },
    dispatch(event) {
      switch (event.type) {
        case 'start_sequence':
          // AC-12 / AC-13: idle からのみ CQ シーケンスを開始し、応答待ち状態へ。
          if (state.kind !== 'idle') return []
          phaseTx = 0
          answers = []
          state = makeState('cq_calling')
          return []
        case 'decode': {
          const msg = parseMessage(event.text)
          if (!msg) return []
          return handleDecode(msg, event.offsetHz)
        }
        case 'slot':
          return handleSlot(event.parity)
      }
    },
  }
}
