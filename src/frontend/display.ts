import { NextVisitView, StayView, ViewModel } from './viewModel'

const monthNames = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.']

/** Day of month (1 to 31) and month (1 to 12) of a date. The year is not needed for the short format. */
type DayAndMonth = { day: number; month: number }

/** Parses `YYYY-MM-DD` without time zone conversion. `undefined` when the text is not such a date. */
function parseDayAndMonth(date: string): DayAndMonth | undefined {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return undefined
  const month = Number(match[1])
  const day = Number(match[2])
  const isValid = month >= 1 && month <= 12 && day >= 1 && day <= 31
  return isValid ? { day, month } : undefined
}

/** Month abbreviation in Norwegian, e.g. `okt.` for month 10. */
function monthName(month: number): string {
  return monthNames[month - 1]
}

/** One day, e.g. `6. okt.`. */
function formatSingleDay({ day, month }: DayAndMonth): string {
  return `${day}. ${monthName(month)}`
}

/** Days within one month, e.g. `6.–9. okt.`. Both dates must be in the same month. */
function formatDaysInSameMonth(start: DayAndMonth, end: DayAndMonth): string {
  return `${start.day}.–${end.day}. ${monthName(end.month)}`
}

/** Days across two months, e.g. `30. sep.–2. okt.`. */
function formatDaysAcrossMonths(start: DayAndMonth, end: DayAndMonth): string {
  return `${formatSingleDay(start)}–${formatSingleDay(end)}`
}

/**
 * Short Norwegian date range from two `YYYY-MM-DD` strings, without the year and without time zone conversion:
 * - same day: `6. okt.`
 * - same month: `6.–9. okt.`
 * - different months: `30. sep.–2. okt.`
 *
 * Falls back to the raw strings (`start–end`) when a date is not valid, so the template never shows nothing.
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDayAndMonth(startDate)
  const end = parseDayAndMonth(endDate)
  if (!start || !end) return `${startDate}–${endDate}`

  const isSameMonth = start.month === end.month
  const isSameDay = isSameMonth && start.day === end.day

  if (isSameDay) return formatSingleDay(start)
  if (isSameMonth) return formatDaysInSameMonth(start, end)
  return formatDaysAcrossMonths(start, end)
}

/** The stay as the template renders it: the raw values plus a formatted date range. */
export type StayDisplay = StayView & { dateRange: string }

/** The next visit as the template renders it: the raw values plus a formatted date range. */
export type NextVisitDisplay = NextVisitView & { dateRange: string }

/** {@link ViewModel} plus the formatted values the template cannot compute itself. */
export type TemplateData = Omit<ViewModel, 'stay' | 'nextVisit'> & {
  stay: StayDisplay | null
  nextVisit: NextVisitDisplay | null
}

/** Adds the formatted date range to the stay. `null` stays `null`. */
function withStayDateRange(stay: StayView | null): StayDisplay | null {
  if (!stay) return null
  return { ...stay, dateRange: formatDateRange(stay.startDate, stay.endDate) }
}

/** Adds the formatted date range to the next visit. `null` stays `null`. */
function withNextVisitDateRange(nextVisit: NextVisitView | null): NextVisitDisplay | null {
  if (!nextVisit) return null
  return { ...nextVisit, dateRange: formatDateRange(nextVisit.startDate, nextVisit.endDate) }
}

/** Adds the formatted date ranges to the view model. Everything else is passed through unchanged. */
export function toTemplateData(viewModel: ViewModel): TemplateData {
  return {
    ...viewModel,
    stay: withStayDateRange(viewModel.stay),
    nextVisit: withNextVisitDateRange(viewModel.nextVisit),
  }
}
