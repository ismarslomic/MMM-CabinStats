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
  /** Show the block with the upcoming reservation. */
  showNextVisit: boolean
  /** Show the cabin fun facts strip. */
  showCabinFacts: boolean
  /** Stop polling and rotation in `suspend()` and fetch fresh data in `resume()`. */
  pauseWhenHidden: boolean
  /** Fade duration in milliseconds passed to `updateDom` when the content changes. */
  animationSpeed: number
}
