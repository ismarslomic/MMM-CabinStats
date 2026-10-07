import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FrontendModule } from '../../src/types/FrontendModule'
import { defaultConfig } from '../../src/types/Config'
import { MM2ModuleHelper } from './mocks/module'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import notOccupiedNext from '../fixtures/not-occupied-next.json'

const mockModuleRegister = vi.fn()
const moduleMock: MM2ModuleHelper = { register: mockModuleRegister }
global.Module = moduleMock
const sendSocketNotificationMock = vi.fn()

const apiBaseUrl = 'http://backend.example:8080'

const response = (liveStats: unknown, identifier = 'module_1') => ({ identifier, liveStats, fetchedAt: 1_000 })

describe('Frontend', () => {
  // resetModules gives the frontend its own logger mock instance, so import the one it uses.
  let Log: typeof import('logger')

  beforeEach(async () => {
    vi.resetModules()
    await import('../../src/frontend/Frontend')
    Log = await import('logger')
  })

  it('should register client implementation', () => {
    expect(mockModuleRegister).toHaveBeenCalled()

    const { name, implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
    expect(name).toBe('MMM-CabinStats')
    expect(implementation.defaults).toEqual({
      apiBaseUrl: undefined,
      updateInterval: 600_000,
      requestTimeout: 10_000,
      guestFactInterval: 18_000,
      cabinFactInterval: 45_000,
      showNextVisit: true,
      showCabinFacts: true,
      pauseWhenHidden: false,
      animationSpeed: 1_000,
    })
    expect(typeof implementation.start).toBe('function')
    expect(typeof implementation.getStyles).toBe('function')
    expect(typeof implementation.getTemplate).toBe('function')
    expect(typeof implementation.getTemplateData).toBe('function')
    expect(typeof implementation.socketNotificationReceived).toBe('function')
  })

  describe('rendering', () => {
    it('renders nothing before the first socket response', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
      implementation.start()
      expect(implementation.getTemplateData().view).toBe('empty')
    })

    it('renders the config error without apiBaseUrl, never fetches and never starts timers', () => {
      vi.useFakeTimers()
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        apiBaseUrl: undefined,
      })
      implementation.start()
      expect(implementation.getTemplateData().view).toBe('config-error')
      expect(sendSocketNotificationMock).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
      expect(Log.error).toHaveBeenCalledWith(expect.stringContaining('apiBaseUrl'))
      vi.useRealTimers()
    })

    it('logs invalid options and uses the defaults', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, { updateInterval: -5 })
      implementation.start()
      expect(Log.error).toHaveBeenCalledWith(expect.stringContaining('invalid updateInterval'))
    })

    it('renders the occupied view after a socket response', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
      implementation.start()
      vi.mocked(implementation.updateDom).mockClear()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      const data = implementation.getTemplateData()
      expect(data.view).toBe('occupied')
      expect(data.guests.map((g) => g.firstName)).toEqual(['Anna', 'Bjørn', 'Carl'])
      expect(implementation.updateDom).toHaveBeenCalledExactlyOnceWith(1000)
    })

    it('renders the compact view when the cabin is not occupied', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(notOccupiedNext))
      expect(implementation.getTemplateData().view).toBe('compact')
    })
  })

  describe('socket instance isolation', () => {
    it('includes the instance identifier with the request', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
      implementation.loadData()
      expect(sendSocketNotificationMock).toHaveBeenLastCalledWith('LIVE_STATS_REQUEST', {
        identifier: 'module_1',
        config: implementation.config,
      })
    })

    it('keeps independent data across interleaved responses', () => {
      const first = checkAndExtractRegistration(mockModuleRegister.mock.lastCall).implementation
      const second: FrontendModule = {
        ...checkAndExtractRegistration(mockModuleRegister.mock.lastCall).implementation,
        identifier: 'module_2',
      }
      for (const instance of [first, second]) {
        instance.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed, 'module_1'))
        instance.socketNotificationReceived('LIVE_STATS_RESPONSE', response(notOccupiedNext, 'module_2'))
      }
      expect(first.getTemplateData().view).toBe('occupied')
      expect(second.getTemplateData().view).toBe('compact')
      expect(first.updateDom).toHaveBeenCalledTimes(1)
      expect(second.updateDom).toHaveBeenCalledTimes(1)
    })

    it('ignores errors for other instances', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
      implementation.socketNotificationReceived('LIVE_STATS_ERROR', { identifier: 'module_2', message: 'boom' })
      expect(Log.error).not.toHaveBeenCalled()
    })
  })

  it.each([
    null,
    {},
    { identifier: 'module_1', fetchedAt: 1, liveStats: { isOccupied: true } },
    { identifier: 'module_1', fetchedAt: NaN, liveStats: occupiedMixed },
    { identifier: 'module_1', fetchedAt: 1e30, liveStats: 'text' },
  ])('ignores malformed socket responses: %p', (payload) => {
    const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
    implementation.start()
    vi.mocked(implementation.updateDom).mockClear()
    implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', payload)
    expect(implementation.getTemplateData().view).toBe('empty')
    expect(implementation.updateDom).not.toHaveBeenCalled()
  })

  it('keeps the last good data and does not re-render on an error', () => {
    const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
    implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
    vi.mocked(implementation.updateDom).mockClear()
    implementation.socketNotificationReceived('LIVE_STATS_ERROR', { identifier: 'module_1', message: 'boom' })
    expect(implementation.getTemplateData().view).toBe('occupied')
    expect(implementation.updateDom).not.toHaveBeenCalled()
    expect(Log.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
  })

  it('logs malformed errors and unknown notifications', () => {
    const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)
    implementation.socketNotificationReceived('LIVE_STATS_ERROR', {})
    implementation.socketNotificationReceived('SOMETHING_ELSE', {})
    expect(Log.error).toHaveBeenCalledTimes(2)
  })

  describe('polling lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      sendSocketNotificationMock.mockClear()
    })

    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    it('uses the configured interval and keeps only one polling timer after repeated start', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        updateInterval: 2000,
      })
      implementation.start()
      implementation.start()
      // One polling timer plus the two rotation timers.
      expect(vi.getTimerCount()).toBe(3)
      sendSocketNotificationMock.mockClear()
      vi.advanceTimersByTime(1999)
      expect(sendSocketNotificationMock).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(sendSocketNotificationMock).toHaveBeenCalledTimes(1)
    })

    it('pauses when opted in and refreshes once on resume', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        pauseWhenHidden: true,
        updateInterval: 10_000,
      })
      implementation.start()
      implementation.suspend()
      sendSocketNotificationMock.mockClear()
      vi.advanceTimersByTime(60_000)
      expect(sendSocketNotificationMock).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
      implementation.resume()
      implementation.resume()
      expect(sendSocketNotificationMock).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(3)
      vi.advanceTimersByTime(10_000)
      expect(sendSocketNotificationMock).toHaveBeenCalledTimes(2)
    })

    it('continues polling and rotating while hidden by default', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        updateInterval: 10_000,
      })
      implementation.start()
      implementation.suspend()
      sendSocketNotificationMock.mockClear()
      vi.advanceTimersByTime(10_000)
      expect(sendSocketNotificationMock).toHaveBeenCalledTimes(1)
      implementation.resume()
      expect(vi.getTimerCount()).toBe(3)
      expect(sendSocketNotificationMock).toHaveBeenCalledTimes(1)
    })

    it.each([0, -1, NaN, Infinity, 2147483648, 1.5])(
      'falls back to the default for invalid intervals: %p',
      (updateInterval) => {
        const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, { updateInterval })
        implementation.startPolling()
        vi.advanceTimersByTime(defaultConfig.updateInterval - 1)
        expect(sendSocketNotificationMock).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(sendSocketNotificationMock).toHaveBeenCalledTimes(1)
      }
    )
  })

  describe('fact rotation', () => {
    const options = { guestFactInterval: 10_000, cabinFactInterval: 30_000, animationSpeed: 0 }

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    it('rotates the guest facts on their interval and wraps around', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, options)
      implementation.start()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      expect(implementation.getTemplateData().guestFact).toBe('Anna har vært på hytta flest ganger.')
      vi.advanceTimersByTime(10_000)
      expect(implementation.getTemplateData().guestFact).toBe('Dette er Carls første besøk!')
      vi.advanceTimersByTime(10_000)
      expect(implementation.getTemplateData().guestFact).toBe('Gjengen har vært samlet 5 ganger.')
      vi.advanceTimersByTime(10_000)
      expect(implementation.getTemplateData().guestFact).toBe('Anna har vært på hytta flest ganger.')
    })

    it('rotates the cabin facts independently on their own interval', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, options)
      implementation.start()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      expect(implementation.getTemplateData().cabinFact).toBe('Hytta har vært besøkt 120 ganger.')
      vi.advanceTimersByTime(30_000)
      expect(implementation.getTemplateData().cabinFact).toBe('Det er 300 netter totalt.')
      vi.advanceTimersByTime(30_000)
      expect(implementation.getTemplateData().cabinFact).toBe('Hytta har vært besøkt 120 ganger.')
    })

    it('does not re-render when there is at most one fact', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, options)
      implementation.start()
      implementation.socketNotificationReceived(
        'LIVE_STATS_RESPONSE',
        response({
          ...occupiedMixed,
          guestFunFacts: occupiedMixed.guestFunFacts.slice(0, 1),
          cabinFunFacts: occupiedMixed.cabinFunFacts.slice(0, 1),
        })
      )
      vi.mocked(implementation.updateDom).mockClear()
      vi.advanceTimersByTime(60_000)
      expect(implementation.updateDom).not.toHaveBeenCalled()
    })

    it('does not rotate guest facts when the cabin is not occupied', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, options)
      implementation.start()
      implementation.socketNotificationReceived(
        'LIVE_STATS_RESPONSE',
        response({ ...notOccupiedNext, cabinFunFacts: [] })
      )
      vi.mocked(implementation.updateDom).mockClear()
      vi.advanceTimersByTime(60_000)
      expect(implementation.updateDom).not.toHaveBeenCalled()
    })

    it('does not rotate cabin facts when showCabinFacts is off', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        ...options,
        showCabinFacts: false,
      })
      implementation.start()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response({ ...notOccupiedNext }))
      vi.mocked(implementation.updateDom).mockClear()
      vi.advanceTimersByTime(60_000)
      expect(implementation.updateDom).not.toHaveBeenCalled()
    })

    it('keeps the index in range and restarts the timers when new data arrives', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, options)
      implementation.start()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      vi.advanceTimersByTime(20_000)
      expect(implementation.getTemplateData().guestFact).toBe('Gjengen har vært samlet 5 ganger.')

      vi.advanceTimersByTime(5_000)
      implementation.socketNotificationReceived(
        'LIVE_STATS_RESPONSE',
        response({ ...occupiedMixed, guestFunFacts: occupiedMixed.guestFunFacts.slice(0, 2) })
      )
      expect(implementation.getTemplateData().guestFact).toBe('Dette er Carls første besøk!')
      // The timers restarted with the new data: still 3 timers, and the next rotation is a full interval away.
      expect(vi.getTimerCount()).toBe(3)
      vi.advanceTimersByTime(9_999)
      expect(implementation.getTemplateData().guestFact).toBe('Dette er Carls første besøk!')
      vi.advanceTimersByTime(1)
      expect(implementation.getTemplateData().guestFact).toBe('Anna har vært på hytta flest ganger.')
    })

    it('stops rotating on suspend when pauseWhenHidden is set and resumes with one set of timers', () => {
      const { implementation } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall, {
        ...options,
        pauseWhenHidden: true,
      })
      implementation.start()
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      implementation.suspend()
      // A response while hidden must not restart the timers.
      implementation.socketNotificationReceived('LIVE_STATS_RESPONSE', response(occupiedMixed))
      expect(vi.getTimerCount()).toBe(0)
      implementation.resume()
      implementation.resume()
      expect(vi.getTimerCount()).toBe(3)
    })
  })

  describe('getStyles overriden function', () => {
    it('should return correct styles', () => {
      const {
        implementation: { getStyles },
      } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)

      expect(getStyles()).toEqual(['/file/css/MMM-CabinStats.css'])
    })
  })

  describe('getTemplate overriden function', () => {
    it('should return correct template', () => {
      const {
        implementation: { getTemplate },
      } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)

      expect(getTemplate()).toEqual('templates/MMM-CabinStats.njk')
    })
  })

  describe('getTranslations', () => {
    it('offers Norwegian only, which is also the fallback', () => {
      const {
        implementation: { getTranslations },
      } = checkAndExtractRegistration(mockModuleRegister.mock.lastCall)

      expect(getTranslations()).toEqual({ nb: 'translations/nb.json' })
    })
  })
})

const checkAndExtractRegistration = (call?: unknown, configOverrides: Record<string, unknown> = {}) => {
  if (!Array.isArray(call) || call.length !== 2) {
    throw new Error('Module registration call did not happen!')
  }
  const name = call[0] as string
  const implementation = call[1] as FrontendModule

  // Add MM2 inherited bits into implementation
  const enhancedImplementation: FrontendModule = {
    ...implementation,
    name: 'MMM-CabinStats',
    config: { ...defaultConfig, apiBaseUrl, ...configOverrides },
    identifier: 'module_1',
    updateDom: vi.fn(),
    file: (fileName: string) => `/file/${fileName}`,
    sendSocketNotification: sendSocketNotificationMock,
  }
  // Make use of this
  enhancedImplementation.getStyles = enhancedImplementation.getStyles.bind(enhancedImplementation)
  enhancedImplementation.start = enhancedImplementation.start.bind(enhancedImplementation)
  enhancedImplementation.startRotation = enhancedImplementation.startRotation.bind(enhancedImplementation)
  enhancedImplementation.stopRotation = enhancedImplementation.stopRotation.bind(enhancedImplementation)
  enhancedImplementation.rotateGuestFact = enhancedImplementation.rotateGuestFact.bind(enhancedImplementation)
  enhancedImplementation.rotateCabinFact = enhancedImplementation.rotateCabinFact.bind(enhancedImplementation)

  return {
    name,
    implementation: enhancedImplementation,
  }
}
