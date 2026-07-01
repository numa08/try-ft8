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

/** `<to> DE <from>[ 73]` / `CQ DE <from>` の受信テキスト形式。 */
const MESSAGE_PATTERN = /^(CQ|[A-Z0-9]{3}) DE ([A-Z0-9]{3})( 73)?$/

/** `CQ DE <me>`(AC-12)。 */
export function cqMessage(me: string): string {
  return `CQ DE ${me}`
}

/** `<them> DE <me>`(AC-26 応答局の初回送信)。 */
export function callMessage(them: string, me: string): string {
  return `${them} DE ${me}`
}

/** `<them> DE <me> 73`(AC-27 / AC-28 完了時)。 */
export function seventyThreeMessage(them: string, me: string): string {
  return `${them} DE ${me} 73`
}

/** AC-25: 生成メッセージが 13 文字以内かどうか。 */
export function isWithinLimit(message: string): boolean {
  return message.length <= MAX_MESSAGE_LENGTH
}

/**
 * 受信テキストを `<to> DE <from>[ 73]` / `CQ DE <from>` として解釈する。
 * 形式に合致しなければ null(デコードノイズ耐性)。
 */
export function parseMessage(text: string): ParsedMessage | null {
  const match = MESSAGE_PATTERN.exec(text)
  if (!match) {
    return null
  }
  const to = match[1]
  return {
    to,
    from: match[2],
    isCq: to === 'CQ',
    is73: match[3] !== undefined,
  }
}
