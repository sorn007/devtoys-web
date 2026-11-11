import { describe, expect, it } from 'vitest'
import { isUuid, NIL_UUID, uuidBatch, uuidv4, uuidv7 } from '@/tools/uuid'

describe('uuidv4', () => {
  it('matches the canonical shape and sets version/variant bits', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidv4()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })

  it('does not repeat in a reasonable sample', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => uuidv4()))
    expect(seen.size).toBe(1000)
  })
})

describe('uuidv7', () => {
  it('is sortable by generation time and carries version 7', () => {
    const earlier = uuidv7(1_700_000_000_000)
    const later = uuidv7(1_700_000_001_000)
    expect(earlier).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(earlier < later).toBe(true)
  })
})

describe('uuidBatch', () => {
  it('returns the requested count', () => {
    expect(uuidBatch(10)).toHaveLength(10)
  })

  it('clamps to the documented maximum', () => {
    expect(uuidBatch(100_000)).toHaveLength(500)
  })

  it('applies uppercase and braces', () => {
    const [id] = uuidBatch(1, 4, true, true)
    expect(id).toMatch(/^\{[0-9A-F-]{36}\}$/)
  })

  it('clamps zero and negative counts to zero', () => {
    expect(uuidBatch(0)).toHaveLength(0)
    expect(uuidBatch(-3)).toHaveLength(0)
  })
})

describe('isUuid', () => {
  it('accepts well-formed v4 and nil UUIDs', () => {
    expect(isUuid(uuidv4())).toBe(true)
    expect(isUuid(NIL_UUID)).toBe(true)
    expect(isUuid(`{${uuidv4()}}`)).toBe(true)
  })

  it('rejects malformed and non-RFC variants', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('12345678-1234-1234-1234-123456789012')).toBe(false) // bad variant nibble
    expect(isUuid('')).toBe(false)
  })
})
