import { describe, it, expect } from 'vitest'
import { validateName } from '../../src/domain/name'

// AC-2 / AC-6: 名前は大文字英数字(A-Z, 0-9)ちょうど3文字。
describe('validateName (AC-2, AC-6)', () => {
  it('大文字英数字ちょうど3文字を受理する', () => {
    for (const ok of ['ABC', '999', 'Z0Z', 'A1B', '000']) {
      expect(validateName(ok)).toEqual({ ok: true, name: ok })
    }
  })

  it('3文字未満は拒否する', () => {
    expect(validateName('AB').ok).toBe(false)
    expect(validateName('').ok).toBe(false)
  })

  it('3文字超は拒否する', () => {
    expect(validateName('ABCD').ok).toBe(false)
  })

  it('小文字は拒否する', () => {
    expect(validateName('abc').ok).toBe(false)
    expect(validateName('aB1').ok).toBe(false)
  })

  it('スペースや記号を含む場合は拒否する', () => {
    expect(validateName('A B').ok).toBe(false)
    expect(validateName('A-B').ok).toBe(false)
    expect(validateName('A.B').ok).toBe(false)
  })

  it('拒否時は理由を返す', () => {
    const result = validateName('abcd')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0)
  })
})
