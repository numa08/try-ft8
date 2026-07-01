import { describe, it, expect } from 'vitest'
import { createQsoLogStore } from '../../src/domain/log'

// 環境非依存の in-memory Storage(注入してテストする)。
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

describe('QSO ログストア (AC-17, AC-21, AC-22, AC-23, AC-31)', () => {
  it('AC-21: 交信相手を保存する', () => {
    const store = createQsoLogStore(memoryStorage())
    store.add({ name: 'ABC', at: 1000 })
    expect(store.list().map((e) => e.name)).toContain('ABC')
  })

  it('AC-22: 新しい順で一覧する', () => {
    const store = createQsoLogStore(memoryStorage())
    store.add({ name: 'ABC', at: 1000 })
    store.add({ name: 'XYZ', at: 2000 })
    expect(store.list().map((e) => e.name)).toEqual(['XYZ', 'ABC'])
  })

  it('AC-17: 既交信相手を has で判定する', () => {
    const store = createQsoLogStore(memoryStorage())
    store.add({ name: 'ABC', at: 1000 })
    expect(store.has('ABC')).toBe(true)
    expect(store.has('ZZZ')).toBe(false)
  })

  it('AC-31: 交信人数を数える(同名は重複しない)', () => {
    const store = createQsoLogStore(memoryStorage())
    store.add({ name: 'ABC', at: 1000 })
    store.add({ name: 'XYZ', at: 2000 })
    store.add({ name: 'ABC', at: 3000 })
    expect(store.count()).toBe(2)
  })

  it('AC-23: 指定名を削除する', () => {
    const store = createQsoLogStore(memoryStorage())
    store.add({ name: 'ABC', at: 1000 })
    store.add({ name: 'XYZ', at: 2000 })
    store.remove('ABC')
    expect(store.has('ABC')).toBe(false)
    expect(store.count()).toBe(1)
  })

  it('永続化: 同じ storage を渡した別インスタンスから読める', () => {
    const storage = memoryStorage()
    const a = createQsoLogStore(storage)
    a.add({ name: 'ABC', at: 1000 })
    const b = createQsoLogStore(storage)
    expect(b.has('ABC')).toBe(true)
  })

  it('壊れた JSON でも例外を投げず空として扱う', () => {
    const storage = memoryStorage()
    storage.setItem('ft8-demo/qso-log', '{broken')
    const store = createQsoLogStore(storage)
    expect(store.list()).toEqual([])
  })
})
