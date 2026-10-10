import { LiveGuestStats, LiveStats } from '../types/LiveStats'
import { avatarUrlFor } from './viewModel'
import { initials } from './initials'

/** Where the guest view is in loading the stats of the guest. */
export type GuestViewStatus = 'loading' | 'loaded' | 'error'

/**
 * What the frontend remembers about the open guest view. The guest is a snapshot taken when the view was opened, so
 * live stats updates never change an open view.
 */
export type GuestViewState = {
  guest: LiveGuestStats
  status: GuestViewStatus
}

/** The open guest view as the overlay renders it. Pure data, no formatting. */
export type GuestOverlayModel = {
  guestId: string
  /** First and last name, e.g. `Anna Testesen`. */
  fullName: string
  firstName: string
  initials: string
  /** Absolute avatar url, `null` when the guest has no avatar: show the initials. */
  avatarUrl: string | null
  status: GuestViewStatus
}

/** Finds a guest of the ongoing or the next reservation. `undefined` when the guest is not in the live stats. */
export function findGuest(liveStats: LiveStats | undefined, guestId: string): LiveGuestStats | undefined {
  const guests = [...(liveStats?.currentReservation?.guests ?? []), ...(liveStats?.nextReservation?.guests ?? [])]
  return guests.find((guest) => guest.guestId === guestId)
}

/** Builds what the overlay renders from the guest and the state of the view. */
export function buildGuestOverlayModel(
  guest: LiveGuestStats,
  apiBaseUrl: string | undefined,
  status: GuestViewStatus
): GuestOverlayModel {
  return {
    guestId: guest.guestId,
    fullName: `${guest.firstName} ${guest.lastName}`.trim(),
    firstName: guest.firstName,
    initials: initials(guest.firstName, guest.lastName),
    avatarUrl: avatarUrlFor(apiBaseUrl, guest.avatarUrl),
    status,
  }
}
