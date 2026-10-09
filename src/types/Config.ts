/** Which parts of the module an instance renders. */
export type Display = 'full' | 'stats' | 'facts'

export const displays: readonly Display[] = ['full', 'stats', 'facts']

/** Module configuration, set per instance in the `config` section of `config.js`. */
export type Config = {
  /**
   * Base url of the cabin stats backend, e.g. `http://backend.example:8080`. A trailing slash is tolerated.
   * Required: there is no default, and without a valid value the module shows a config error and never fetches.
   */
  apiBaseUrl: string | undefined
  /** Poll interval in milliseconds (the backend data changes slowly). Invalid values fall back to the default. */
  updateInterval: number
  /** Timeout of a single backend request in milliseconds. */
  requestTimeout: number
  /** Rotation interval of the guest fun facts in milliseconds (15–20 s recommended). */
  guestFactInterval: number
  /** Rotation interval of the cabin fun facts in milliseconds (30–60 s recommended). */
  cabinFactInterval: number
  /**
   * What this instance renders: `full` everything, `stats` everything except the guest and cabin facts, `facts` only
   * the guest and cabin facts. Use two instances at different positions to place the facts elsewhere.
   */
  display: Display
  /** Show the block with the upcoming reservation. */
  showNextVisit: boolean
  /** Show the cabin fun facts strip. */
  showCabinFacts: boolean
  /** Stop polling and rotation in `suspend()` and fetch fresh data in `resume()`. */
  pauseWhenHidden: boolean
  /** Fade duration in milliseconds passed to `updateDom` when the content changes. */
  animationSpeed: number
}

/** JavaScript timers use a signed 32-bit delay; larger values overflow. */
const maximumTimerDelay = 2 ** 31 - 1

/** Defaults of every option except `apiBaseUrl`, which is required and has no default. */
export const defaultConfig: Config = {
  apiBaseUrl: undefined,
  updateInterval: 600_000,
  requestTimeout: 10_000,
  guestFactInterval: 18_000,
  cabinFactInterval: 45_000,
  display: 'full',
  showNextVisit: true,
  showCabinFacts: true,
  pauseWhenHidden: false,
  animationSpeed: 1_000,
}

/** Config where `apiBaseUrl` is known to be a valid, normalised http(s) url without trailing slash. */
export type ResolvedConfig = Config & { apiBaseUrl: string }

/**
 * Normalises `apiBaseUrl`: trims whitespace and trailing slashes. Returns `undefined` when the value is missing,
 * not a string, or not an absolute `http` or `https` url.
 */
export function normaliseApiBaseUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().replace(/\/+$/, '')
  try {
    const { protocol } = new URL(trimmed)
    return protocol === 'http:' || protocol === 'https:' ? trimmed : undefined
  } catch {
    return undefined
  }
}

function positiveTimerDelay(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maximumTimerDelay
    ? value
    : fallback
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Validates and normalises the config of a module instance. Invalid values fall back to {@link defaultConfig}; an
 * invalid or missing `apiBaseUrl` stays `undefined` so callers can show the config error and skip fetching.
 */
export function resolveConfig(raw: unknown): Config {
  const config: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    apiBaseUrl: normaliseApiBaseUrl(config.apiBaseUrl),
    updateInterval: positiveTimerDelay(config.updateInterval, defaultConfig.updateInterval),
    requestTimeout: positiveTimerDelay(config.requestTimeout, defaultConfig.requestTimeout),
    guestFactInterval: positiveTimerDelay(config.guestFactInterval, defaultConfig.guestFactInterval),
    cabinFactInterval: positiveTimerDelay(config.cabinFactInterval, defaultConfig.cabinFactInterval),
    display: oneOf(config.display, displays, defaultConfig.display),
    showNextVisit: boolean(config.showNextVisit, defaultConfig.showNextVisit),
    showCabinFacts: boolean(config.showCabinFacts, defaultConfig.showCabinFacts),
    pauseWhenHidden: boolean(config.pauseWhenHidden, defaultConfig.pauseWhenHidden),
    animationSpeed: nonNegativeInteger(config.animationSpeed, defaultConfig.animationSpeed),
  }
}

/** Type guard for a config that has a usable `apiBaseUrl`. */
export function hasApiBaseUrl(config: Config): config is ResolvedConfig {
  return config.apiBaseUrl !== undefined
}
