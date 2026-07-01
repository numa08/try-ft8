import { describe, it, expect } from 'vitest'
import { loadHandle, saveHandle } from '../../src/domain/handle'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => {
      m.delete(k)
    },
    setItem: (k: string, v: string) => {
      m.set(k, String(v))
    },
  }
}

// AC-33: ユーザー名の永続化・復元。
describe('handle 永続化 (AC-33)', () => {
  it('保存した名前を読み戻せる', () => {
    const storage = memoryStorage()
    saveHandle('ABC', storage)
    expect(loadHandle(storage)).toBe('ABC')
  })

  it('未保存なら null', () => {
    expect(loadHandle(memoryStorage())).toBeNull()
  })

  it('別インスタンス(再読み込み相当)でも同じ storage から復元できる', () => {
    const storage = memoryStorage()
    saveHandle('XyZ'.toUpperCase(), storage)
    expect(loadHandle(storage)).toBe('XYZ')
  })

  it('3文字ルール外の壊れた値は null として扱う', () => {
    const storage = memoryStorage()
    storage.setItem('ft8-demo/handle', 'abcd')
    expect(loadHandle(storage)).toBeNull()
  })
})
