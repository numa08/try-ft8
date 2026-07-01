/**
 * 契約(型シグネチャ)だけ先に確定させ、実装は /goal による自律実装で埋めるためのプレースホルダ。
 * 受入テストはこの契約に対して赤(失敗)の状態で用意され、実装が入ると緑になる。
 */
export function notImplemented(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn}: not implemented yet`)
}
