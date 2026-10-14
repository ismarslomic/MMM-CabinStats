export type UnknownRecord = Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** `YYYY-MM-DD` that is also a real calendar date (rejects `2026-02-31`). */
export function isIsoDate(value: unknown): value is string {
  if (!isString(value) || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** The backend sends explicit `null` for absent values, but the spec leaves them out of `required`. */
export function isOptional(value: unknown, isValid: (value: unknown) => boolean): boolean {
  return value === undefined || value === null || isValid(value)
}

export function isArrayOf(value: unknown, isValid: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(isValid)
}
