import * as Log from 'logger'
import { GuestProfileStats } from '../types/GuestProfileStats'
import { GuestStats, LiveStats } from '../types/LiveStats'
import { fetchAvatar } from './fetchAvatar'
import { FetchLiveStatsOptions } from './fetchLiveStats'

/** Avatars by absolute url. The backend changes `avatarUrl` when the image changes, so an entry never goes stale. */
const cache = new Map<string, string>()

/** Upper bound on cached avatars, so a long-running mirror cannot grow without limit. */
const maximumCacheSize = 100

/** Empties the avatar cache. For tests. */
export function clearAvatarCache(): void {
  cache.clear()
}

async function dataUriFor(url: string, options: FetchLiveStatsOptions, fetchFn: typeof fetch): Promise<string | null> {
  const cached = cache.get(url)
  if (cached) return cached
  try {
    const dataUri = await fetchAvatar(url, options, fetchFn)
    if (cache.size >= maximumCacheSize) cache.clear()
    cache.set(url, dataUri)
    return dataUri
  } catch (error) {
    Log.warn(`Could not load avatar: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Returns the guests with `avatarUrl` replaced by a `data:` url of the image, which the backend only serves with the
 * API key. A guest whose avatar cannot be loaded gets `null`, so the frontend shows the initials.
 */
export async function resolveAvatars(
  guests: readonly GuestStats[],
  options: FetchLiveStatsOptions,
  fetchFn: typeof fetch = fetch
): Promise<GuestStats[]> {
  return Promise.all(
    guests.map(async (guest) => {
      if (!guest.avatarUrl) return guest
      const path = guest.avatarUrl.startsWith('/') ? guest.avatarUrl : `/${guest.avatarUrl}`
      return { ...guest, avatarUrl: await dataUriFor(`${options.apiBaseUrl}${path}`, options, fetchFn) }
    })
  )
}

/** {@link resolveAvatars} for every guest of the current and next reservation. */
export async function resolveLiveStatsAvatars(
  liveStats: LiveStats,
  options: FetchLiveStatsOptions,
  fetchFn: typeof fetch = fetch
): Promise<LiveStats> {
  const { currentReservation, nextReservation } = liveStats
  return {
    ...liveStats,
    currentReservation: currentReservation && {
      ...currentReservation,
      guests: await resolveAvatars(currentReservation.guests, options, fetchFn),
    },
    nextReservation: nextReservation && {
      ...nextReservation,
      guests: await resolveAvatars(nextReservation.guests, options, fetchFn),
    },
  }
}

/** {@link resolveAvatars} for the guest of a profile. */
export async function resolveProfileAvatars(
  profile: GuestProfileStats,
  options: FetchLiveStatsOptions,
  fetchFn: typeof fetch = fetch
): Promise<GuestProfileStats> {
  const [guest] = await resolveAvatars([profile.guest], options, fetchFn)
  return { ...profile, guest }
}
