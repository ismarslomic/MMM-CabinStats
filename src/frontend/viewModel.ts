import { Config, Display, normaliseApiBaseUrl } from '../types/Config'
import { LiveGuestStats, LiveStats } from '../types/LiveStats'
import { initials } from './initials'
import { clampIndex, interleaveGuestFacts } from './rotation'

/**
 * Which view the template renders:
 * - `config-error`: `apiBaseUrl` is missing or invalid, nothing is fetched.
 * - `empty`: no data has been loaded yet (or the backend has never answered). Renders nothing.
 * - `occupied`: the cabin is occupied, guests of the current reservation are shown.
 * - `compact`: the cabin is not occupied, next visit and totals are shown.
 */
export type ViewName = 'config-error' | 'empty' | 'occupied' | 'compact'

/** A guest as the template needs it. */
export type GuestView = {
  guestId: string
  firstName: string
  /** Absolute avatar url, `null` when the guest has no avatar (or no valid `apiBaseUrl`): show the initials. */
  avatarUrl: string | null
  initials: string
  isFirstVisit: boolean
  /** True when the guest has the most visits of all time (rank 1). */
  isTopVisitor: boolean
  /** Number of this visit counted over all time (`allTime.totalVisits`, includes the current reservation). */
  visitNumber: number
}

/** The ongoing stay, `null` unless the view is `occupied`. */
export type StayView = {
  startDate: string
  endDate: string
  remainingNights: number
}

/** The upcoming reservation, `null` when there is none or `showNextVisit` is off. */
export type NextVisitView = {
  startDate: string
  endDate: string
  daysUntil: number
  guests: GuestView[]
  /** Highest priority fact about the next visit, `null` when there is none. */
  fact: string | null
}

/** Everything the template renders, derived from the stats and the rotation state. Pure data, no formatting. */
export type ViewModel = {
  view: ViewName
  /** Which parts the template renders, from the `display` option. */
  display: Display
  stay: StayView | null
  guests: GuestView[]
  /** Current guest fact in the rotation, `null` when there is none. Only set for the `occupied` view. */
  guestFact: string | null
  /** Current cabin fact in the rotation, `null` when there is none or `showCabinFacts` is off. */
  cabinFact: string | null
  nextVisit: NextVisitView | null
  totals: { visits: number; nights: number; uniqueGuests: number } | null
  /** Animation speed in milliseconds for `updateDom`. */
  animationSpeed: number
}

/** Input of {@link buildViewModel}. */
export type ViewModelInput = {
  config: Config
  /** `undefined` until the first successful response. */
  liveStats: LiveStats | undefined
  guestFactIndex: number
  cabinFactIndex: number
}

const emptyViewModel = (view: ViewName, display: Display, animationSpeed: number): ViewModel => ({
  view,
  display,
  stay: null,
  guests: [],
  guestFact: null,
  cabinFact: null,
  nextVisit: null,
  totals: null,
  animationSpeed,
})

/** Joins the base url with the relative avatar url from the backend. `null` when either is missing. */
export function avatarUrlFor(apiBaseUrl: string | undefined, avatarUrl: string | null | undefined): string | null {
  if (!apiBaseUrl || !avatarUrl) return null
  return `${apiBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`
}

function toGuestView(guest: LiveGuestStats, apiBaseUrl: string | undefined): GuestView {
  return {
    guestId: guest.guestId,
    firstName: guest.firstName,
    avatarUrl: avatarUrlFor(apiBaseUrl, guest.avatarUrl),
    initials: initials(guest.firstName, guest.lastName),
    isFirstVisit: guest.isFirstVisit,
    isTopVisitor: guest.allTime.visitsRank === 1,
    visitNumber: guest.allTime.totalVisits,
  }
}

/** Builds the template data from the config, the latest stats and the rotation indices. */
export function buildViewModel({ config, liveStats, guestFactIndex, cabinFactIndex }: ViewModelInput): ViewModel {
  const { animationSpeed, display } = config
  const apiBaseUrl = normaliseApiBaseUrl(config.apiBaseUrl)
  if (apiBaseUrl === undefined) return emptyViewModel('config-error', display, animationSpeed)
  if (liveStats === undefined) return emptyViewModel('empty', display, animationSpeed)

  const current = liveStats.isOccupied ? liveStats.currentReservation : null
  const next = config.showNextVisit ? liveStats.nextReservation : null
  const guestFacts = current && display !== 'stats' ? interleaveGuestFacts(liveStats.guestFunFacts) : []
  const cabinFacts = config.showCabinFacts && display !== 'stats' ? liveStats.cabinFunFacts : []

  return {
    view: current ? 'occupied' : 'compact',
    display,
    stay: current
      ? { startDate: current.startDate, endDate: current.endDate, remainingNights: current.remainingNights }
      : null,
    guests: current ? current.guests.map((guest) => toGuestView(guest, apiBaseUrl)) : [],
    guestFact: guestFacts[clampIndex(guestFactIndex, guestFacts.length)]?.text ?? null,
    cabinFact: cabinFacts[clampIndex(cabinFactIndex, cabinFacts.length)]?.text ?? null,
    nextVisit: next
      ? {
          startDate: next.startDate,
          endDate: next.endDate,
          daysUntil: next.daysUntil,
          guests: next.guests.map((guest) => toGuestView(guest, apiBaseUrl)),
          fact: liveStats.nextVisitFunFacts[0]?.text ?? null,
        }
      : null,
    totals: {
      visits: liveStats.allTimeVisits,
      nights: liveStats.allTimeNights,
      uniqueGuests: liveStats.allTimeUniqueGuests,
    },
    animationSpeed,
  }
}
