import { describe, expect, test } from 'vitest'
import { clampIndex, interleaveGuestFacts, nextIndex } from '../../src/frontend/rotation'
import { FunFact } from '../../src/types/LiveStats'

const fact = (text: string, guestId: string | null = null, priority = 50): FunFact => ({ guestId, text, priority })
const texts = (facts: FunFact[]) => facts.map((f) => f.text)

describe('interleaveGuestFacts', () => {
  test('returns an empty list for no facts', () => {
    expect(interleaveGuestFacts([])).toEqual([])
  })

  test('keeps the order for a single guest', () => {
    const facts = [fact('a1', 'a'), fact('a2', 'a'), fact('a3', 'a')]
    expect(texts(interleaveGuestFacts(facts))).toEqual(['a1', 'a2', 'a3'])
  })

  test('round-robins between guests so each gets a turn before anyone gets a second', () => {
    const facts = [fact('a1', 'a'), fact('a2', 'a'), fact('a3', 'a'), fact('b1', 'b'), fact('c1', 'c'), fact('c2', 'c')]
    expect(texts(interleaveGuestFacts(facts))).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3'])
  })

  test('takes part with group facts (no guestId) as one more participant', () => {
    const facts = [fact('g1'), fact('a1', 'a'), fact('g2'), fact('a2', 'a')]
    expect(texts(interleaveGuestFacts(facts))).toEqual(['g1', 'a1', 'g2', 'a2'])
  })

  test('treats a missing guestId like null', () => {
    const missing = { text: 'missing', priority: 1 } as FunFact
    expect(texts(interleaveGuestFacts([missing, fact('g1'), fact('a1', 'a')]))).toEqual(['missing', 'a1', 'g1'])
  })

  test('does not change the input', () => {
    const facts = [fact('a1', 'a'), fact('b1', 'b'), fact('a2', 'a')]
    const copy = [...facts]
    interleaveGuestFacts(facts)
    expect(facts).toEqual(copy)
  })
})

describe('nextIndex', () => {
  test.each([
    [0, 3, 1],
    [1, 3, 2],
    [2, 3, 0],
    [0, 1, 0],
    [5, 0, 0],
  ])('after %i of %i comes %i', (index, length, expected) => {
    expect(nextIndex(index, length)).toBe(expected)
  })
})

describe('clampIndex', () => {
  test.each([
    [0, 3, 0],
    [2, 3, 2],
    [3, 3, 2],
    [10, 3, 2],
    [-1, 3, 0],
    [4, 0, 0],
  ])('index %i in a list of %i becomes %i', (index, length, expected) => {
    expect(clampIndex(index, length)).toBe(expected)
  })
})
