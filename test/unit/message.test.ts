import { describe, it, expect } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  cqMessage,
  callMessage,
  seventyThreeMessage,
  isWithinLimit,
  parseMessage,
} from '../../src/domain/message'

describe('message format (SPEC 3)', () => {
  it('CQ メッセージは `CQ DE <me>`', () => {
    expect(cqMessage('ABC')).toBe('CQ DE ABC')
  })

  it('応答初回は `<them> DE <me>`(AC-26)', () => {
    expect(callMessage('ABC', 'XYZ')).toBe('ABC DE XYZ')
  })

  it('73 メッセージは `<them> DE <me> 73`(AC-27 / AC-28)', () => {
    expect(seventyThreeMessage('ABC', 'XYZ')).toBe('ABC DE XYZ 73')
  })
})

// AC-25: 送信する全メッセージは 13 文字を超えない。最長は `XXX DE YYY 73` = 13。
describe('13 文字上限の不変条件 (AC-25)', () => {
  it('最長メッセージ `XXX DE YYY 73` はちょうど 13 文字', () => {
    expect(seventyThreeMessage('XXX', 'YYY')).toHaveLength(13)
    expect(MAX_MESSAGE_LENGTH).toBe(13)
  })

  it('生成されうる全メッセージが 13 文字以内', () => {
    const names = ['ABC', '999', 'Z0Z', 'A1B', '000', 'QQQ', 'M8N']
    for (const me of names) {
      expect(isWithinLimit(cqMessage(me))).toBe(true)
      for (const them of names) {
        expect(isWithinLimit(callMessage(them, me))).toBe(true)
        expect(isWithinLimit(seventyThreeMessage(them, me))).toBe(true)
      }
    }
  })

  it('isWithinLimit は 13 文字を境界に判定する', () => {
    expect(isWithinLimit('X'.repeat(13))).toBe(true)
    expect(isWithinLimit('X'.repeat(14))).toBe(false)
  })
})

describe('parseMessage', () => {
  it('CQ を解釈する', () => {
    expect(parseMessage('CQ DE ABC')).toEqual({
      to: 'CQ',
      from: 'ABC',
      isCq: true,
      is73: false,
    })
  })

  it('通常の呼び出しを解釈する', () => {
    expect(parseMessage('ABC DE XYZ')).toEqual({
      to: 'ABC',
      from: 'XYZ',
      isCq: false,
      is73: false,
    })
  })

  it('73 付きを解釈する', () => {
    expect(parseMessage('ABC DE XYZ 73')).toEqual({
      to: 'ABC',
      from: 'XYZ',
      isCq: false,
      is73: true,
    })
  })

  it('形式に合わないテキストは null', () => {
    expect(parseMessage('')).toBeNull()
    expect(parseMessage('HELLO WORLD')).toBeNull()
    expect(parseMessage('ABC XYZ')).toBeNull()
  })
})
