import { describe, expect, it } from 'vitest'
import { diffLines } from '@/tools/diff'
import { DIFF_MAX_LINES } from '@/lib/limits'

function ops(result: ReturnType<typeof diffLines>) {
  return result.rows.map((r) => r.op)
}

describe('diffLines', () => {
  it('flags identical inputs without an edit script', () => {
    const r = diffLines('a\nb\nc', 'a\nb\nc')
    expect(r.mode).toBe('identical')
    expect(r.added).toBe(0)
    expect(r.removed).toBe(0)
    expect(r.rows).toHaveLength(3)
  })

  it('detects a pure insertion', () => {
    const r = diffLines('a\nc', 'a\nb\nc')
    expect(ops(r)).toEqual(['equal', 'added', 'equal'])
    expect(r.added).toBe(1)
    expect(r.removed).toBe(0)
  })

  it('detects a pure deletion', () => {
    const r = diffLines('a\nb\nc', 'a\nc')
    expect(ops(r)).toEqual(['equal', 'removed', 'equal'])
  })

  it('detects a modified line as remove+add of whole lines', () => {
    const r = diffLines('the quick fox', 'the slow fox')
    expect(ops(r)).toEqual(['removed', 'added'])
    expect(r.removed).toBe(1)
    expect(r.added).toBe(1)
  })

  it('keeps untouched lines around a modification as equal', () => {
    const r = diffLines('one\ntwo\nthree', 'one\nTWO\nthree')
    expect(ops(r)).toEqual(['equal', 'removed', 'added', 'equal'])
  })

  it('numbers both sides and marks unpaired lines', () => {
    const r = diffLines('a\nb', 'a\nc')
    expect(r.rows[1]).toMatchObject({ op: 'removed', text: 'b', leftNo: 2, rightNo: null })
    expect(r.rows[2]).toMatchObject({ op: 'added', text: 'c', leftNo: null, rightNo: 2 })
  })

  it('does not mangle Thai or emoji lines', () => {
    const r = diffLines('สวัสดี\nsame', 'สวัสดีครับ 😀\nsame')
    expect(ops(r)).toEqual(['removed', 'added', 'equal'])
    expect(r.rows[0]).toMatchObject({ op: 'removed', text: 'สวัสดี' })
    expect(r.rows[1]).toMatchObject({ op: 'added', text: 'สวัสดีครับ 😀' })
  })

  it('handles empty sides', () => {
    const r = diffLines('', 'x\ny')
    expect(r.mode).toBe('exact')
    expect(r.added).toBe(2)
  })

  it('treats a trailing newline as formatting, not a phantom empty line', () => {
    const r = diffLines('a\nb\n', 'a\nb')
    expect(r.mode).toBe('identical')
  })

  it('keeps duplicate lines honest', () => {
    const r = diffLines('x\nx\nx', 'x\nx')
    expect(r.removed).toBe(1)
    expect(r.added).toBe(0)
  })

  it('trims a long common suffix without losing it', () => {
    const left = ['head'] .concat(Array.from({ length: 500 }, (_, i) => `same ${i}`))
    const right = ['HEAD'].concat(Array.from({ length: 500 }, (_, i) => `same ${i}`))
    const r = diffLines(left.join('\n'), right.join('\n'))
    expect(r.mode).toBe('exact')
    expect(r.unchanged).toBe(500)
    expect(r.removed + r.added).toBe(2)
  })

  it('degrades to coarse mode instead of blowing the edit-distance cap', () => {
    const left = Array.from({ length: 600 }, (_, i) => `l${i}`)
    const right = Array.from({ length: 600 }, (_, i) => `r${i}`)
    const r = diffLines(left.join('\n'), right.join('\n'))
    expect(r.mode).toBe('coarse')
    expect(r.truncated).toBe(true)
    expect(r.removed).toBe(600)
    expect(r.added).toBe(600)
  })

  it('handles oversized inputs without allocating an edit script', () => {
    const big = Array.from({ length: DIFF_MAX_LINES + 1 }, (_, i) => `line-${i}`)
    const r = diffLines(big.join('\n'), 'different\ncontent')
    expect(r.mode).toBe('coarse')
  })
})
