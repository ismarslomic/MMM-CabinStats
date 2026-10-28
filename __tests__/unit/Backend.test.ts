import { afterEach, beforeEach, describe, expect, test, vi, type MockedFunction } from 'vitest'
import Helper from '../../src/backend/Backend'
import { clearAvatarCache } from '../../src/backend/resolveAvatars'
import { loadBuiltHelper } from './helpers/load-built-helper'
import { NodeHelperModule } from 'node_helper'
import * as Log from 'logger'
import { SocketNotification } from '../../src/constants/SocketNotifications'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import guestProfile from '../fixtures/guest-profile-regular.json'

const config = { apiBaseUrl: 'http://backend.example:8080/', requestTimeout: 5000 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const avatarDataUrl = 'data:image/jpeg;base64,AQID'

/** Answers avatar requests with an image and every other request with the JSON body. */
function routeFetch(body: unknown) {
  return (url: string) =>
    Promise.resolve(
      url.endsWith('/avatar')
        ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })
        : jsonResponse(body)
    )
}

/** Lets the helper's un-awaited async work finish. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Backend', () => {
  let helper: NodeHelperModule
  let mockedSendSocketNotification: MockedFunction<typeof helper.sendSocketNotification>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearAvatarCache()
    helper = new Helper()
    Object.assign(helper, { name: 'MMM-CabinStats' })
    mockedSendSocketNotification = helper.sendSocketNotification as MockedFunction<typeof helper.sendSocketNotification>

    fetchMock = vi.fn().mockResolvedValue(jsonResponse(occupiedMixed))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('the generated CommonJS helper preserves the static create method and fetches', async () => {
    // Loading the distributed file catches bundler interop errors that TS source tests miss.
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-06T09:00:00Z'))
    fetchMock.mockImplementation(routeFetch(occupiedMixed))
    const BuiltHelper = loadBuiltHelper()
    const builtHelper = new BuiltHelper()
    Object.assign(builtHelper, { name: 'MMM-CabinStats' })

    builtHelper.socketNotificationReceived(SocketNotification.LIVE_STATS_REQUEST, {
      identifier: 'built_instance',
      config,
    })
    await flush()

    expect(fetchMock).toHaveBeenCalledWith('http://backend.example:8080/api/stats', expect.anything())
    expect(builtHelper.sendSocketNotification).toHaveBeenCalledWith(SocketNotification.LIVE_STATS_RESPONSE, {
      identifier: 'built_instance',
      liveStats: expect.objectContaining({ isOccupied: occupiedMixed.isOccupied }),
      fetchedAt: Date.now(),
    })
  })

  test('printing to console when starting the Backend module', () => {
    helper.start()
    expect(Log.debug).toHaveBeenCalledWith(`${helper.name} is started!`)
  })

  test.each([null, {}, { identifier: 'module_1' }, { identifier: 'module_1', config: null }, { config: {} }])(
    'ignores malformed requests: %p',
    async (payload) => {
      helper.socketNotificationReceived(SocketNotification.LIVE_STATS_REQUEST, payload)
      await flush()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(mockedSendSocketNotification).not.toHaveBeenCalled()
      expect(Log.error).toHaveBeenCalled()
    }
  )

  test('ignores unknown notifications', async () => {
    helper.socketNotificationReceived('SOMETHING_ELSE', { identifier: 'module_1', config })
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockedSendSocketNotification).not.toHaveBeenCalled()
  })

  test('replies with the live stats and the requesting identifier', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-06T09:00:00Z'))

    fetchMock.mockImplementation(routeFetch(occupiedMixed))
    helper.socketNotificationReceived(SocketNotification.LIVE_STATS_REQUEST, { identifier: 'module_1', config })
    await flush()

    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.example:8080/api/stats')
    expect(fetchMock.mock.calls.slice(1).every(([url]) => url.endsWith('/avatar'))).toBe(true)
    expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.LIVE_STATS_RESPONSE, {
      identifier: 'module_1',
      liveStats: expect.objectContaining({
        currentReservation: expect.objectContaining({
          guests: expect.arrayContaining([expect.objectContaining({ avatarUrl: avatarDataUrl })]),
        }),
      }),
      fetchedAt: Date.now(),
    })
  })

  test.each([undefined, '', 'backend.example', 'ftp://backend.example'])(
    'replies with an error and never fetches when apiBaseUrl is %j',
    async (apiBaseUrl) => {
      helper.socketNotificationReceived(SocketNotification.LIVE_STATS_REQUEST, {
        identifier: 'module_1',
        config: { apiBaseUrl },
      })
      await flush()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.LIVE_STATS_ERROR, {
        identifier: 'module_1',
        message: expect.stringContaining('apiBaseUrl'),
      })
    }
  )

  test.each([
    ['the backend is down', () => fetchMock.mockRejectedValue(new TypeError('fetch failed')), '/api/stats failed'],
    ['the backend returns 500', () => fetchMock.mockResolvedValue(jsonResponse({}, 500)), 'status 500'],
    ['the payload is invalid', () => fetchMock.mockResolvedValue(jsonResponse({ isOccupied: 1 })), 'contract'],
  ])('replies with an error when %s', async (_name, arrange, expectedMessage) => {
    arrange()

    helper.socketNotificationReceived(SocketNotification.LIVE_STATS_REQUEST, { identifier: 'module_1', config })
    await flush()

    expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.LIVE_STATS_ERROR, {
      identifier: 'module_1',
      message: expect.stringContaining(expectedMessage),
    })
  })

  describe('guest profile', () => {
    beforeEach(() => {
      fetchMock.mockImplementation(routeFetch(guestProfile))
    })

    test('replies with the guest profile, the requesting identifier and the guestId', async () => {
      helper.socketNotificationReceived(SocketNotification.GUEST_PROFILE_REQUEST, {
        identifier: 'module_1',
        guestId: 'guest 1',
        config,
      })
      await flush()

      expect(fetchMock.mock.calls[0][0]).toBe('http://backend.example:8080/api/stats/guests/guest%201')
      expect(fetchMock.mock.calls[1][0]).toBe(`http://backend.example:8080${guestProfile.guest.avatarUrl}`)
      expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.GUEST_PROFILE_RESPONSE, {
        identifier: 'module_1',
        guestId: 'guest 1',
        profile: { ...guestProfile, guest: { ...guestProfile.guest, avatarUrl: avatarDataUrl } },
      })
    })

    test.each([null, {}, { identifier: 'module_1', config }, { identifier: 'module_1', guestId: 'guest-1' }])(
      'ignores malformed requests: %p',
      async (payload) => {
        helper.socketNotificationReceived(SocketNotification.GUEST_PROFILE_REQUEST, payload)
        await flush()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(mockedSendSocketNotification).not.toHaveBeenCalled()
        expect(Log.error).toHaveBeenCalled()
      }
    )

    test('replies with an error and never fetches without a valid apiBaseUrl', async () => {
      helper.socketNotificationReceived(SocketNotification.GUEST_PROFILE_REQUEST, {
        identifier: 'module_1',
        guestId: 'guest-1',
        config: {},
      })
      await flush()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.GUEST_PROFILE_ERROR, {
        identifier: 'module_1',
        guestId: 'guest-1',
        message: expect.stringContaining('apiBaseUrl'),
      })
    })

    test.each([
      ['the backend is down', () => fetchMock.mockRejectedValue(new TypeError('fetch failed')), 'failed'],
      ['the guest is unknown', () => fetchMock.mockResolvedValue(jsonResponse({}, 404)), 'status 404'],
      ['the payload is invalid', () => fetchMock.mockResolvedValue(jsonResponse([])), 'contract'],
    ])('replies with an error when %s', async (_name, arrange, expectedMessage) => {
      arrange()

      helper.socketNotificationReceived(SocketNotification.GUEST_PROFILE_REQUEST, {
        identifier: 'module_1',
        guestId: 'guest-1',
        config,
      })
      await flush()

      expect(mockedSendSocketNotification).toHaveBeenCalledExactlyOnceWith(SocketNotification.GUEST_PROFILE_ERROR, {
        identifier: 'module_1',
        guestId: 'guest-1',
        message: expect.stringContaining(expectedMessage),
      })
    })
  })
})
