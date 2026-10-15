import { GuestProfileStats, GuestVisit } from '../types/GuestProfileStats'
import { monthNames } from './display'
import { FactView, toFactView } from './factView'

/** First year of the heatmap. The backend data starts in September 2020, so every guest gets the same grid. */
export const heatmapStartYear = 2020
/** First month with data in {@link heatmapStartYear}. Earlier months are shown as "no data". */
const dataStartMonth = 9

/** A calendar month, used for "today" so the model does not read the clock itself. */
export type YearMonth = { year: number; month: number }

/** The year and month (1 to 12) of a date, in the local time zone of the mirror. */
export function yearMonthOf(date: Date): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/**
 * - `past`: coloured by the number of visits.
 * - `future`: after the current month, drawn dashed.
 * - `nodata`: before the backend has data (Jan–Aug 2020), drawn dashed.
 */
export type HeatmapCellState = 'past' | 'future' | 'nodata'

export type HeatmapCell = {
  /** 1 (January) to 12 (December). */
  month: number
  /** Visits that started in the month. Upcoming visits are not counted. */
  count: number
  /** Colour step from 0 to 4, where 4 means four or more visits. */
  level: 0 | 1 | 2 | 3 | 4
  state: HeatmapCellState
  /** True when an upcoming visit starts in the month. */
  hasUpcoming: boolean
}

export type HeatmapRow = { year: number; cells: HeatmapCell[] }

/** A number in the stat tiles. `of` is set for "5 av 7" style values. */
export type ProfileTile = {
  id: 'visitsPerYear' | 'maxPerMonth' | 'yearsWithVisits' | 'days' | 'nights' | 'longestStay' | 'visitsThisYear'
  /** Ready to display. */
  value: string
  /** The total in "{value} av {of}". */
  of?: number
}

/** The rank shown before the name, e.g. `#3`. Gold for rank 1. */
export type ProfileRank = { value: string; accent: boolean }

/** Everything the profile part of the guest view renders. */
export type ProfileModel = {
  firstYear: number
  lastYear: number
  /** Rank by visits among guests only for a guest, among all guests for family. `null` without visits. */
  rank: ProfileRank | null
  /** Visits of the guest that have started, all time. */
  totalVisits: number
  /** Number of years in the heatmap, as in "the last 7 years". */
  yearsInGrid: number
  heatmap: HeatmapRow[]
  /** The big tiles under the heatmap. Empty when the guest has no visits. */
  primaryTiles: ProfileTile[]
  /** The smaller tiles. Only the ones that have data. */
  secondaryTiles: ProfileTile[]
  /** First visit as `okt. 2020`, `null` without visits. */
  firstVisit: string | null
  /** Last visit as `5. okt. 2025`, `null` without a completed visit. */
  lastVisit: string | null
  /** Ready-to-display fun facts in the order the backend sent them (highest priority first). */
  facts: FactView[]
}

function levelOf(count: number): HeatmapCell['level'] {
  return Math.min(count, 4) as HeatmapCell['level']
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

function stateOf(year: number, month: number, today: YearMonth): HeatmapCellState {
  if (year === heatmapStartYear && month < dataStartMonth) return 'nodata'
  if (year > today.year || (year === today.year && month > today.month)) return 'future'
  return 'past'
}

/**
 * One row per year from 2020 to the current year, one cell per month. A visit counts in the month it started, like
 * the backend counts visits. Completed and ongoing visits colour the cell, upcoming visits only mark it.
 */
export function buildHeatmap(visits: readonly GuestVisit[], today: YearMonth): HeatmapRow[] {
  const started = new Map<string, number>()
  const upcoming = new Set<string>()
  for (const visit of visits) {
    const key = monthKey(visit.startDate)
    if (visit.status === 'UPCOMING') upcoming.add(key)
    else started.set(key, (started.get(key) ?? 0) + 1)
  }

  const lastYear = Math.max(today.year, heatmapStartYear)
  return Array.from({ length: lastYear - heatmapStartYear + 1 }, (_, index) => {
    const year = heatmapStartYear + index
    const cells = Array.from({ length: 12 }, (_, monthIndex): HeatmapCell => {
      const month = monthIndex + 1
      const key = `${year}-${String(month).padStart(2, '0')}`
      const state = stateOf(year, month, today)
      const count = state === 'past' ? (started.get(key) ?? 0) : 0
      return { month, count, level: levelOf(count), state, hasUpcoming: upcoming.has(key) }
    })
    return { year, cells }
  })
}

/** One decimal with a Norwegian comma, e.g. `18,6`. */
function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

/** `2020-10-29` as `okt. 2020`. `null` when the text is not a date. */
function formatMonthYear(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date)
  const month = match ? monthNames[Number(match[2]) - 1] : undefined
  return match && month ? `${month} ${match[1]}` : null
}

/** `2025-10-05` as `5. okt. 2025`. `null` when the text is not a date. */
function formatFullDate(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const month = match ? monthNames[Number(match[2]) - 1] : undefined
  return match && month ? `${Number(match[3])}. ${month} ${match[1]}` : null
}

function primaryTiles(profile: GuestProfileStats, heatmap: HeatmapRow[], yearsInGrid: number): ProfileTile[] {
  const { totalVisits } = profile.guest.allTime
  if (totalVisits === 0) return []
  const maxPerMonth = Math.max(...heatmap.flatMap((row) => row.cells.map((cell) => cell.count)))
  const yearsWithVisits = profile.guest.yearsVisited.filter((year) => year >= heatmapStartYear).length
  return [
    { id: 'visitsPerYear', value: formatDecimal(totalVisits / yearsInGrid) },
    { id: 'maxPerMonth', value: String(maxPerMonth) },
    { id: 'yearsWithVisits', value: String(yearsWithVisits), of: yearsInGrid },
  ]
}

function secondaryTiles(profile: GuestProfileStats): ProfileTile[] {
  const { guest, visits } = profile
  const tiles: ProfileTile[] = []
  if (guest.allTime.totalDays > 0) tiles.push({ id: 'days', value: String(guest.allTime.totalDays) })
  if (guest.allTime.totalNights > 0) tiles.push({ id: 'nights', value: String(guest.allTime.totalNights) })

  const longestStay = Math.max(0, ...visits.filter((visit) => visit.status !== 'UPCOMING').map((visit) => visit.nights))
  if (longestStay > 0) tiles.push({ id: 'longestStay', value: String(longestStay) })

  if (guest.currentYear.totalVisits > 0) {
    tiles.push({ id: 'visitsThisYear', value: String(guest.currentYear.totalVisits) })
  }

  return tiles
}

function rankOf(profile: GuestProfileStats): ProfileRank | null {
  const { guest } = profile
  const rank = guest.isFamily ? guest.allTime.visitsRank : guest.allTime.visitsRankAmongGuests
  return rank === null || rank === undefined ? null : { value: `#${rank}`, accent: rank === 1 }
}

/** Builds what the profile part of the guest view renders from the backend profile and the current month. */
export function buildProfileModel(profile: GuestProfileStats, today: YearMonth): ProfileModel {
  const heatmap = buildHeatmap(profile.visits, today)
  const yearsInGrid = heatmap.length
  const { firstVisitDate, lastVisitDate } = profile.guest
  return {
    firstYear: heatmapStartYear,
    lastYear: heatmapStartYear + yearsInGrid - 1,
    rank: rankOf(profile),
    totalVisits: profile.guest.allTime.totalVisits,
    yearsInGrid,
    heatmap,
    primaryTiles: primaryTiles(profile, heatmap, yearsInGrid),
    secondaryTiles: secondaryTiles(profile),
    firstVisit: firstVisitDate ? formatMonthYear(firstVisitDate) : null,
    lastVisit: lastVisitDate ? formatFullDate(lastVisitDate) : null,
    facts: profile.funFacts.map(toFactView),
  }
}
