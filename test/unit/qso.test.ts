import { describe, it, expect } from 'vitest'
import { createQsoMachine } from '../../src/domain/qso'
import type { QsoAction, QsoMachine } from '../../src/domain/qso'

const never = () => false

function transmits(actions: QsoAction[]): string[] {
  return actions.filter((a) => a.type === 'transmit').map((a) => a.text)
}

// 発信局(Caller): 自分から Start Sequence して CQ を出す。EVEN スロットで送信。
describe('QSO 発信局 (AC-12, AC-13, AC-14, AC-15, AC-18, AC-27, AC-29)', () => {
  it('AC-12/13: start_sequence 後、次の EVEN スロットで CQ を送る', () => {
    const m = createQsoMachine({ me: 'AAA', isKnown: never })
    expect(transmits(m.dispatch({ type: 'start_sequence' }))).toEqual([])
    expect(m.state.kind).toBe('cq_calling') // AC-13: 送信中/応答待ち
    expect(transmits(m.dispatch({ type: 'slot', parity: 'odd' }))).toEqual([]) // ODD では出さない
    expect(transmits(m.dispatch({ type: 'slot', parity: 'even' }))).toEqual(['CQ DE AAA'])
  })

  it('AC-18/27/29: 複数応答は最小オフセット局に応答し、双方 73 で完了', () => {
    const m = createQsoMachine({ me: 'AAA', isKnown: never })
    m.dispatch({ type: 'start_sequence' })
    m.dispatch({ type: 'slot', parity: 'even' }) // CQ 送出
    m.dispatch({ type: 'decode', text: 'AAA DE BBB', offsetHz: 800 })
    m.dispatch({ type: 'decode', text: 'AAA DE CCC', offsetHz: 600 }) // より低い周波数
    // 次 EVEN で最小オフセット(CCC)にのみ 73 を返す(AC-18, AC-27)
    expect(transmits(m.dispatch({ type: 'slot', parity: 'even' }))).toEqual(['CCC DE AAA 73'])
    expect(m.state.peer).toBe('CCC')
    // 相手の 73 を受信 → 双方 73 で完了(AC-29)
    const done = m.dispatch({ type: 'decode', text: 'AAA DE CCC 73', offsetHz: 600 })
    expect(done).toContainEqual({ type: 'completed', peer: 'CCC' })
    expect(m.state.kind).toBe('done')
  })

  it('AC-14/15: 応答が無ければ最大 3 回 CQ を再送し、その後待機へ', () => {
    const m = createQsoMachine({ me: 'AAA', isKnown: never })
    m.dispatch({ type: 'start_sequence' })
    const sent: string[] = []
    for (let i = 0; i < 4; i++) {
      sent.push(...transmits(m.dispatch({ type: 'slot', parity: 'even' })))
    }
    // 初回 + 3 再送 = 計 4 回
    expect(sent).toEqual(['CQ DE AAA', 'CQ DE AAA', 'CQ DE AAA', 'CQ DE AAA'])
    // さらに次の機会では待機へ(AC-15)
    const after = m.dispatch({ type: 'slot', parity: 'even' })
    expect(after).toContainEqual({ type: 'waiting' })
    expect(m.state.kind).toBe('idle')
  })
})

// 応答局(Responder): 他局の CQ に応じる。ODD スロットで送信。
describe('QSO 応答局 (AC-16, AC-17, AC-19, AC-20, AC-26, AC-28, AC-29)', () => {
  it('AC-16/26/28/29: CQ に応答し、交互 73 で完了', () => {
    const m = createQsoMachine({ me: 'BBB', isKnown: never })
    expect(transmits(m.dispatch({ type: 'decode', text: 'CQ DE AAA', offsetHz: 700 }))).toEqual([])
    expect(m.state.kind).toBe('resp_replying')
    expect(m.state.peer).toBe('AAA')
    // AC-26: 次 ODD で `AAA DE BBB`
    expect(transmits(m.dispatch({ type: 'slot', parity: 'even' }))).toEqual([]) // EVEN では出さない
    expect(transmits(m.dispatch({ type: 'slot', parity: 'odd' }))).toEqual(['AAA DE BBB'])
    // AC-28: 相手の 73 を受信 → 次 ODD で自局 73、完了(AC-29)
    m.dispatch({ type: 'decode', text: 'BBB DE AAA 73', offsetHz: 700 })
    const last = m.dispatch({ type: 'slot', parity: 'odd' })
    expect(transmits(last)).toEqual(['AAA DE BBB 73'])
    expect(last).toContainEqual({ type: 'completed', peer: 'AAA' })
    expect(m.state.kind).toBe('done')
  })

  it('AC-17: 既にログにある局の CQ は無視する', () => {
    const m = createQsoMachine({ me: 'BBB', isKnown: (n) => n === 'AAA' })
    expect(transmits(m.dispatch({ type: 'decode', text: 'CQ DE AAA', offsetHz: 700 }))).toEqual([])
    expect(m.state.kind).toBe('idle')
    expect(transmits(m.dispatch({ type: 'slot', parity: 'odd' }))).toEqual([])
  })

  it('AC-19/20: 返信が無ければ直前メッセージを最大 3 回再送し、その後待機へ', () => {
    const m: QsoMachine = createQsoMachine({ me: 'BBB', isKnown: never })
    m.dispatch({ type: 'decode', text: 'CQ DE AAA', offsetHz: 700 })
    const sent: string[] = []
    for (let i = 0; i < 4; i++) {
      sent.push(...transmits(m.dispatch({ type: 'slot', parity: 'odd' })))
    }
    expect(sent).toEqual(['AAA DE BBB', 'AAA DE BBB', 'AAA DE BBB', 'AAA DE BBB'])
    const after = m.dispatch({ type: 'slot', parity: 'odd' })
    expect(after).toContainEqual({ type: 'waiting' })
    expect(m.state.kind).toBe('idle')
  })
})
