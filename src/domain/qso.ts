import { notImplemented } from '../util/notImplemented'
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

export function createQsoMachine(config: QsoConfig): QsoMachine {
  return notImplemented('createQsoMachine', config)
}
