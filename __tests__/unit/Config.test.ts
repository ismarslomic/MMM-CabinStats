import { describe, expect, test } from 'vitest'
import { defaultConfig, hasApiBaseUrl, normaliseApiBaseUrl, resolveConfig } from '../../src/types/Config'

describe('normaliseApiBaseUrl', () => {
  test.each([
    ['http://backend.example:8080', 'http://backend.example:8080'],
    ['http://backend.example:8080/', 'http://backend.example:8080'],
    ['  https://backend.example//  ', 'https://backend.example'],
    ['http://backend.example/prefix/', 'http://backend.example/prefix'],
  ])('accepts %j as %j', (input, expected) => {
    expect(normaliseApiBaseUrl(input)).toBe(expected)
  })

  test.each([undefined, null, 42, '', '   ', 'backend.example:8080', 'ftp://backend.example', 'not a url', {}])(
    'rejects %j',
    (input) => {
      expect(normaliseApiBaseUrl(input)).toBeUndefined()
    }
  )
})

describe('resolveConfig', () => {
  test.each([undefined, null, 'text', 42, {}])('falls back to the defaults for %j', (raw) => {
    expect(resolveConfig(raw)).toEqual(defaultConfig)
  })

  test('has no default for apiBaseUrl', () => {
    expect(hasApiBaseUrl(resolveConfig({}))).toBe(false)
  })

  test('applies partial overrides and keeps the other defaults', () => {
    const config = resolveConfig({
      apiBaseUrl: 'http://backend.example:8080/',
      updateInterval: 60_000,
      showCabinFacts: false,
    })
    expect(config).toEqual({
      ...defaultConfig,
      apiBaseUrl: 'http://backend.example:8080',
      updateInterval: 60_000,
      showCabinFacts: false,
    })
    expect(hasApiBaseUrl(config)).toBe(true)
  })

  test.each(['updateInterval', 'requestTimeout', 'guestFactInterval', 'cabinFactInterval'] as const)(
    'falls back for an invalid %s',
    (option) => {
      for (const invalid of [0, -1, 1.5, Number.NaN, Infinity, 2 ** 31, '1000', null]) {
        expect(resolveConfig({ [option]: invalid })[option]).toBe(defaultConfig[option])
      }
      expect(resolveConfig({ [option]: 5000 })[option]).toBe(5000)
    }
  )

  test.each(['showNextVisit', 'showCabinFacts', 'pauseWhenHidden'] as const)(
    'falls back for a non-boolean %s',
    (option) => {
      expect(resolveConfig({ [option]: 'yes' })[option]).toBe(defaultConfig[option])
      expect(resolveConfig({ [option]: !defaultConfig[option] })[option]).toBe(!defaultConfig[option])
    }
  )

  test('accepts animationSpeed 0 and rejects negative or fractional values', () => {
    expect(resolveConfig({ animationSpeed: 0 }).animationSpeed).toBe(0)
    expect(resolveConfig({ animationSpeed: -1 }).animationSpeed).toBe(defaultConfig.animationSpeed)
    expect(resolveConfig({ animationSpeed: 0.5 }).animationSpeed).toBe(defaultConfig.animationSpeed)
  })
})
