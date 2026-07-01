import { NAME_PATTERN } from './name'

/** AC-33: ユーザー名(ハンドル)の保存キー。 */
export const HANDLE_STORAGE_KEY = 'ft8-demo/handle'

/**
 * 永続化されたユーザー名を読み出す。未保存や壊れた値(3文字ルール外)は null。
 * storage 未指定時は既定の localStorage。
 */
export function loadHandle(storage: Storage = localStorage): string | null {
  try {
    const value = storage.getItem(HANDLE_STORAGE_KEY)
    return value !== null && NAME_PATTERN.test(value) ? value : null
  } catch {
    // storage 使用不可(プライベートモード等)は未保存扱い。
    return null
  }
}

/** AC-33: ユーザー名を永続化する。 */
export function saveHandle(name: string, storage: Storage = localStorage): void {
  try {
    storage.setItem(HANDLE_STORAGE_KEY, name)
  } catch {
    // storage 使用不可時は黙って諦める(名前は当該セッションでのみ有効)。
  }
}
