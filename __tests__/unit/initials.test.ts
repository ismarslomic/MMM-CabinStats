import { describe, expect, test } from 'vitest'
import { initials } from '../../src/frontend/initials'

describe('initials', () => {
  test.each([
    ['Anna', 'Testesen', 'AT'],
    ['anna', 'testesen', 'AT'],
    ['Øyvind', 'Åsen', 'ØÅ'],
    ['  Eva ', ' Eksempel', 'EE'],
    ['Eva', '', 'E'],
    ['', 'Eksempel', 'E'],
    ['😀smile', 'Test', '😀T'],
    ['', '', '?'],
    [' ', ' ', '?'],
  ])('%j %j gives %j', (first, last, expected) => {
    expect(initials(first, last)).toBe(expected)
  })
})
