import { describe, expect, test } from 'vitest'
import { toFactView } from '../../src/frontend/factView'
import { FunFact } from '../../src/types/LiveStats'

const fact = (overrides: Partial<FunFact> = {}): FunFact => ({ text: 'Hei Dina', priority: 50, ...overrides })

describe('toFactView', () => {
  test('keeps the segments in order and the text of the fact', () => {
    const view = toFactView(
      fact({
        text: 'Det er 12 måneder siden sist, Dina!',
        segments: [
          { text: 'Det er ' },
          { text: '12 måneder', kind: 'stat' },
          { text: ' siden sist, ' },
          { text: 'Dina', kind: 'guest' },
          { text: '!', kind: 'text' },
        ],
      })
    )

    expect(view.text).toBe('Det er 12 måneder siden sist, Dina!')
    expect(view.segments).toEqual([
      { text: 'Det er ', kind: 'text' },
      { text: '12 måneder', kind: 'stat' },
      { text: ' siden sist, ', kind: 'text' },
      { text: 'Dina', kind: 'guest' },
      { text: '!', kind: 'text' },
    ])
    expect(view.segments.map((segment) => segment.text).join('')).toBe(view.text)
  })

  test('treats a kind it does not know as plain text', () => {
    const view = toFactView(fact({ segments: [{ text: 'Hei ' }, { text: 'Dina', kind: 'future' as 'guest' }] }))
    expect(view.segments).toEqual([
      { text: 'Hei ', kind: 'text' },
      { text: 'Dina', kind: 'text' },
    ])
  })

  test.each([
    ['missing', undefined],
    ['empty', []],
  ])('falls back to the whole text as one plain part when segments are %s', (_name, segments) => {
    expect(toFactView(fact({ segments }))).toEqual({
      text: 'Hei Dina',
      segments: [{ text: 'Hei Dina', kind: 'text' }],
    })
  })
})
