/** LocalStorage の保存キー。 */
export const LOG_STORAGE_KEY = 'ft8-demo/qso-log'

export interface QsoLogEntry {
  /** 交信相手の名前(3文字)。 */
  name: string
  /** 交信成立(完了)時刻 epoch(ms)。 */
  at: number
}

export interface QsoLogStore {
  /** AC-21: 交信相手のログを保存(同名は最新で上書き)。 */
  add(entry: QsoLogEntry): void
  /** AC-22: 保存済みログを新しい順で返す。 */
  list(): QsoLogEntry[]
  /** AC-17: 既に交信済みの相手かどうか。 */
  has(name: string): boolean
  /** AC-23: 指定名のログを削除する。 */
  remove(name: string): void
  /** AC-31: これまでに交信成立した相手の人数。 */
  count(): number
  clear(): void
}

function isEntry(value: unknown): value is QsoLogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QsoLogEntry).name === 'string' &&
    typeof (value as QsoLogEntry).at === 'number'
  )
}

/**
 * LocalStorage を裏付けとした QSO ログストア。storage 未指定時は既定の localStorage。
 * テストでは in-memory な Storage 実装を注入できる。
 */
export function createQsoLogStore(storage: Storage = localStorage): QsoLogStore {
  // 破損した JSON でも例外を投げず空として扱う(AC 運用中の堅牢性)。
  function read(): QsoLogEntry[] {
    try {
      const raw = storage.getItem(LOG_STORAGE_KEY)
      if (!raw) {
        return []
      }
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(isEntry)
    } catch {
      return []
    }
  }

  function write(entries: QsoLogEntry[]): void {
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries))
  }

  return {
    add(entry) {
      const entries = read().filter((e) => e.name !== entry.name)
      entries.push(entry)
      write(entries)
    },
    list() {
      return read().sort((a, b) => b.at - a.at)
    },
    has(name) {
      return read().some((e) => e.name === name)
    },
    remove(name) {
      write(read().filter((e) => e.name !== name))
    },
    count() {
      return new Set(read().map((e) => e.name)).size
    },
    clear() {
      storage.removeItem(LOG_STORAGE_KEY)
    },
  }
}
