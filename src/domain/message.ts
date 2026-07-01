import { notImplemented } from '../util/notImplemented'

/** AC-25: FT8 フリーテキストの上限。`XXX DE YYY 73` = 13 文字ちょうどが最長。 */
export const MAX_MESSAGE_LENGTH = 13

export interface ParsedMessage {
  /** 宛先(CQ の場合は 'CQ')。 */
  to: string
  /** 送信元の名前。 */
  from: string
  isCq: boolean
  is73: boolean
}

/** `CQ DE <me>`(AC-12)。 */
export function cqMessage(me: string): string {
  return notImplemented('cqMessage', me)
}

/** `<them> DE <me>`(AC-26 応答局の初回送信)。 */
export function callMessage(them: string, me: string): string {
  return notImplemented('callMessage', them, me)
}

/** `<them> DE <me> 73`(AC-27 / AC-28 完了時)。 */
export function seventyThreeMessage(them: string, me: string): string {
  return notImplemented('seventyThreeMessage', them, me)
}

/** AC-25: 生成メッセージが 13 文字以内かどうか。 */
export function isWithinLimit(message: string): boolean {
  return notImplemented('isWithinLimit', message)
}

/**
 * 受信テキストを `<to> DE <from>[ 73]` / `CQ DE <from>` として解釈する。
 * 形式に合致しなければ null(デコードノイズ耐性)。
 */
export function parseMessage(text: string): ParsedMessage | null {
  return notImplemented('parseMessage', text)
}
