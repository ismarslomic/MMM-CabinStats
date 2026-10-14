import { describe, expect, test } from 'vitest'
import {
  isGuestProfileError,
  isGuestProfileRequest,
  isGuestProfileResponse,
  isLiveStatsError,
  isLiveStatsRequest,
  isLiveStatsResponse,
} from '../../src/types/Messages'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import guestProfile from '../fixtures/guest-profile-regular.json'

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

describe('isGuestProfileRequest', () => {
  test('accepts a live stats request with a guestId', () => {
    expect(isGuestProfileRequest({ identifier: 'module_1', config: {}, guestId: 'guest-1' })).toBe(true)
  })

  test.each([
    null,
    {},
    { identifier: 'module_1', config: {} },
    { identifier: 'module_1', config: {}, guestId: '' },
    { identifier: 'module_1', config: {}, guestId: 1 },
    { identifier: 'module_1', guestId: 'guest-1' },
  ])('rejects %j', (payload) => {
    expect(isGuestProfileRequest(payload)).toBe(false)
  })
})

describe('isGuestProfileResponse', () => {
  const valid = { identifier: 'module_1', guestId: 'guest-1', profile: guestProfile }

  test('accepts a valid guest profile', () => {
    expect(isGuestProfileResponse(valid)).toBe(true)
  })

  test.each([
    ['null', null],
    ['no identifier', { ...valid, identifier: undefined }],
    ['no guestId', { ...valid, guestId: undefined }],
    ['profile as text', { ...valid, profile: 'x' }],
    ['profile as array', { ...valid, profile: [] }],
    ['profile without visits', { ...valid, profile: { ...guestProfile, visits: undefined } }],
    [
      'visit with unknown status',
      { ...valid, profile: { ...guestProfile, visits: [{ ...guestProfile.visits[0], status: 'LOST' }] } },
    ],
    [
      'visit with invalid date',
      { ...valid, profile: { ...guestProfile, visits: [{ ...guestProfile.visits[0], startDate: '2026-02-31' }] } },
    ],
    ['fun fact without text', { ...valid, profile: { ...guestProfile, funFacts: [{ priority: 1 }] } }],
    ['no profile', { identifier: 'module_1', guestId: 'guest-1' }],
  ])('rejects %s', (_name, payload) => {
    expect(isGuestProfileResponse(payload)).toBe(false)
  })
})

describe('isGuestProfileError', () => {
  test('accepts identifier, guestId and message', () => {
    expect(isGuestProfileError({ identifier: 'module_1', guestId: 'guest-1', message: 'boom' })).toBe(true)
  })

  test.each([null, {}, { identifier: 'module_1', message: 'boom' }, { identifier: 'module_1', guestId: 'guest-1' }])(
    'rejects %j',
    (payload) => {
      expect(isGuestProfileError(payload)).toBe(false)
    }
  )
})
