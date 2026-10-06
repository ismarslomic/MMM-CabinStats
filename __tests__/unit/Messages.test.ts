import { describe, expect, test } from 'vitest'
import { isLiveStatsError, isLiveStatsRequest, isLiveStatsResponse } from '../../src/types/Messages'
import occupiedMixed from '../fixtures/occupied-mixed.json'

describe('isLiveStatsRequest', () => {
  test('accepts identifier with a config object', () => {
    expect(isLiveStatsRequest({ identifier: 'module_1', config: {} })).toBe(true)
  })

  test.each([
    null,
    'x',
    {},
    { identifier: 1, config: {} },
    { identifier: 'module_1' },
    { identifier: 'module_1', config: null },
  ])('rejects %j', (payload) => {
    expect(isLiveStatsRequest(payload)).toBe(false)
  })
})

describe('isLiveStatsResponse', () => {
  const valid = { identifier: 'module_1', liveStats: occupiedMixed, fetchedAt: 1_700_000_000_000 }

  test('accepts a valid response', () => {
    expect(isLiveStatsResponse(valid)).toBe(true)
  })

  test.each([
    ['null', null],
    ['no identifier', { ...valid, identifier: undefined }],
    ['fetchedAt as string', { ...valid, fetchedAt: '1' }],
    ['fetchedAt NaN', { ...valid, fetchedAt: Number.NaN }],
    ['invalid liveStats', { ...valid, liveStats: { isOccupied: true } }],
  ])('rejects %s', (_name, payload) => {
    expect(isLiveStatsResponse(payload)).toBe(false)
  })
})

describe('isLiveStatsError', () => {
  test('accepts identifier with message', () => {
    expect(isLiveStatsError({ identifier: 'module_1', message: 'boom' })).toBe(true)
  })

  test.each([null, {}, { identifier: 'module_1' }, { identifier: 'module_1', message: 1 }])('rejects %j', (payload) => {
    expect(isLiveStatsError(payload)).toBe(false)
  })
})
