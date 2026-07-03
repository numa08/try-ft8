/** AC-2 / AC-6: 名前は大文字英数字(A-Z, 0-9)ちょうど3文字。 */
export const NAME_PATTERN = /^[A-Z0-9]{3}$/

export type NameValidation = { ok: true; name: string } | { ok: false; reason: string }

/**
 * 入力名を検証する。AC-2 の不変条件: 大文字英数字ちょうど3文字のみ受理し、
 * それ以外は理由コードで拒否する(3文字固定は 13 文字メッセージ上限を守るための必須制約)。
 * 表示メッセージは言語に依存するため i18n 側で解決する。reason は安定した理由コード。
 */
export function validateName(input: string): NameValidation {
  if (NAME_PATTERN.test(input)) {
    return { ok: true, name: input }
  }
  return { ok: false, reason: 'name_format' }
}
