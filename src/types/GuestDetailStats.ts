import type { components } from './api.generated'

/** Response of the backend `GET /api/stats/guests/{guestId}`, generated from the OpenAPI spec. Empty for now. */
export type GuestDetailStats = components['schemas']['GuestDetailStats']

/** Type guard for {@link GuestDetailStats}: any JSON object, because the contract has no properties yet. */
export function isGuestDetailStats(value: unknown): value is GuestDetailStats {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
