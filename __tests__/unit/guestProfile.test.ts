import { describe, expect, test } from 'vitest'
import { buildHeatmap, buildProfileModel, yearMonthOf } from '../../src/frontend/guestProfile'
import { GuestProfileStats, GuestVisit } from '../../src/types/GuestProfileStats'
import regular from '../fixtures/guest-profile-regular.json'
import sporadic from '../fixtures/guest-profile-sporadic.json'
import firstVisit from '../fixtures/guest-profile-first-visit.json'
import noVisits from '../fixtures/guest-profile-no-visits.json'

const today = { year: 2026, month: 10 }

function visit(startDate: string, status: GuestVisit['status'] = 'COMPLETED'): GuestVisit {
  return { startDate, endDate: startDate, days: 1, nights: 0, status }
}

function cell(rows: ReturnType<typeof buildHeatmap>, year: number, month: number) {
  return rows.find((row) => row.year === year)!.cells[month - 1]
}

describe('yearMonthOf', () => {
  test('gives the year and the month from 1 to 12', () => {
    expect(yearMonthOf(new Date(2026, 9, 10))).toEqual({ year: 2026, month: 10 })
    expect(yearMonthOf(new Date(2027, 0, 1))).toEqual({ year: 2027, month: 1 })
  })
})

describe('buildHeatmap', () => {
  test('has one row per year from 2020 to the current year with twelve cells each', () => {
    const rows = buildHeatmap([], today)
    expect(rows.map((row) => row.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026])
    expect(rows.every((row) => row.cells.length === 12)).toBe(true)
    expect(rows[0].cells.map((c) => c.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  test('grows by one row in January', () => {
    const rows = buildHeatmap([], { year: 2027, month: 1 })
    expect(rows.at(-1)?.year).toBe(2027)
    expect(cell(rows, 2027, 1).state).toBe('past')
    expect(cell(rows, 2027, 2).state).toBe('future')
  })

  test('never has fewer rows than the start year, even with a wrong clock', () => {
    expect(buildHeatmap([], { year: 1999, month: 1 }).map((row) => row.year)).toEqual([2020])
  })

  test('counts a visit in the month it started, and a stay across months only once', () => {
    const crossing = { ...visit('2025-07-30'), endDate: '2025-08-02', days: 4, nights: 3 }
    const rows = buildHeatmap([crossing, visit('2025-07-04')], today)
    expect(cell(rows, 2025, 7).count).toBe(2)
    expect(cell(rows, 2025, 8).count).toBe(0)
  })

  test('counts ongoing visits and caps the level at 4', () => {
    const visits = [
      visit('2026-10-01'),
      visit('2026-10-02', 'ONGOING'),
      visit('2026-10-03'),
      visit('2026-10-04'),
      visit('2026-10-05'),
      visit('2026-10-06'),
    ]
    expect(cell(buildHeatmap(visits, today), 2026, 10)).toMatchObject({ count: 6, level: 4 })
    expect(cell(buildHeatmap(visits.slice(0, 2), today), 2026, 10)).toMatchObject({ count: 2, level: 2 })
  })

  test('does not count upcoming visits, but marks their month', () => {
    const rows = buildHeatmap([visit('2026-11-20', 'UPCOMING'), visit('2026-10-18', 'UPCOMING')], today)
    expect(cell(rows, 2026, 11)).toMatchObject({ count: 0, level: 0, state: 'future', hasUpcoming: true })
    expect(cell(rows, 2026, 10)).toMatchObject({ count: 0, state: 'past', hasUpcoming: true })
    expect(cell(rows, 2026, 12).hasUpcoming).toBe(false)
  })

  test('marks the months after today as future and the months before the data as no data', () => {
    const rows = buildHeatmap([], today)
    expect(cell(rows, 2026, 10).state).toBe('past')
    expect(cell(rows, 2026, 11).state).toBe('future')
    expect(cell(rows, 2020, 8).state).toBe('nodata')
    expect(cell(rows, 2020, 9).state).toBe('past')
    expect(cell(rows, 2021, 1).state).toBe('past')
  })
})

describe('buildProfileModel', () => {
  const model = (profile: unknown) => buildProfileModel(profile as GuestProfileStats, today)
  const ids = (tiles: { id: string }[]) => tiles.map((tile) => tile.id)

  test('builds the headline, years and the heatmap for a regular guest', () => {
    const result = model(regular)
    expect(result).toMatchObject({ firstYear: 2020, lastYear: 2026, yearsInGrid: 7, totalVisits: 125 })
    expect(result.heatmap).toHaveLength(7)
    const counted = result.heatmap.flatMap((row) => row.cells).reduce((sum, c) => sum + c.count, 0)
    expect(counted).toBe(result.totalVisits)
  })

  test('computes the primary tiles', () => {
    const [perYear, maxPerMonth, years] = model(regular).primaryTiles
    expect(perYear).toEqual({ id: 'visitsPerYear', value: '17,9' }) // 125 / 7
    expect(maxPerMonth.id).toBe('maxPerMonth')
    expect(Number(maxPerMonth.value)).toBeGreaterThan(0)
    expect(years).toEqual({ id: 'yearsWithVisits', value: '7', of: 7 })
  })

  test('counts the years with visits for a sporadic guest', () => {
    const { primaryTiles } = model(sporadic)
    expect(primaryTiles.find((tile) => tile.id === 'yearsWithVisits')).toMatchObject({ of: 7 })
    expect(Number(primaryTiles[2].value)).toBeLessThan(7)
  })

  test('puts the rank among guests on a guest, and the rank among all on family', () => {
    expect(model(sporadic).rank).toEqual({ value: '#9', accent: false })
    expect(model(regular).rank).toEqual({ value: '#1', accent: true })
  })

  test('has no rank tile, and no rank without a rank', () => {
    const profile = structuredClone(sporadic)
    ;(profile.guest.allTime as Record<string, unknown>).visitsRankAmongGuests = null
    expect(model(profile).rank).toBeNull()
    expect(ids(model(sporadic).secondaryTiles)).not.toContain('rank')
  })

  test('shows the total days and nights, from the guest stats', () => {
    const tiles = model(regular).secondaryTiles
    expect(tiles.find((tile) => tile.id === 'days')?.value).toBe(String(regular.guest.allTime.totalDays))
    expect(tiles.find((tile) => tile.id === 'nights')?.value).toBe(String(regular.guest.allTime.totalNights))
    expect(ids(tiles)).toEqual(['days', 'nights', 'longestStay', 'visitsThisYear'])
  })

  test('hides the visits this year tile without visits this year', () => {
    const profile = structuredClone(regular)
    profile.guest.currentYear.totalVisits = 0
    expect(ids(model(regular).secondaryTiles)).toContain('visitsThisYear')
    expect(ids(model(profile).secondaryTiles)).not.toContain('visitsThisYear')
  })

  test('takes the longest stay from visits that have started only', () => {
    const profile = structuredClone(sporadic) as GuestProfileStats
    profile.visits = [
      { ...visit('2024-05-01'), nights: 3 },
      { ...visit('2026-10-04', 'ONGOING'), nights: 4 },
      { ...visit('2026-11-20', 'UPCOMING'), nights: 30 },
    ]
    expect(model(profile).secondaryTiles.find((tile) => tile.id === 'longestStay')?.value).toBe('4')
  })

  test('formats the first and the last visit', () => {
    expect(model(regular)).toMatchObject({ firstVisit: 'sep. 2020' })
    expect(model(sporadic).lastVisit).toMatch(/^\d{1,2}\. \S+ \d{4}$/)
  })

  test('keeps the fun facts in the order of the backend', () => {
    expect(model(regular).facts).toEqual(regular.funFacts.map((fact) => fact.text))
  })

  test('has no tiles, dates or facts for a guest without visits', () => {
    expect(model(noVisits)).toMatchObject({
      totalVisits: 0,
      primaryTiles: [],
      secondaryTiles: [],
      rank: null,
      firstVisit: null,
      lastVisit: null,
      facts: [],
    })
  })

  test('handles a guest on the first visit', () => {
    const result = model(firstVisit)
    expect(result.totalVisits).toBe(1)
    expect(cell(result.heatmap, 2026, 10).count).toBe(1)
    expect(result.lastVisit).toBeNull()
    expect(result.primaryTiles[0]).toEqual({ id: 'visitsPerYear', value: '0,1' })
  })
})
