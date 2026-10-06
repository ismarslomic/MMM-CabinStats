import { FunFact } from '../types/LiveStats'

/**
 * Orders guest facts for rotation: round-robin between the guests, so every guest gets a turn before anyone gets a
 * second one. Facts without a `guestId` (about the whole group) take part as one more "guest". The order the backend
 * sorted them in (priority, descending) is kept within each guest, and first appearance decides the order between
 * guests.
 */
export function interleaveGuestFacts(facts: readonly FunFact[]): FunFact[] {
  const queues = new Map<string | null, FunFact[]>()
  for (const fact of facts) {
    const key = fact.guestId ?? null
    const queue = queues.get(key)
    if (queue) queue.push(fact)
    else queues.set(key, [fact])
  }

  const result: FunFact[] = []
  const lists = [...queues.values()]
  for (let round = 0; result.length < facts.length; round++) {
    for (const list of lists) {
      if (round < list.length) result.push(list[round])
    }
  }
  return result
}

/** Index of the next fact, wrapping around. `0` for an empty list. */
export function nextIndex(index: number, length: number): number {
  return length > 0 ? (index + 1) % length : 0
}

/** Keeps `index` inside `[0, length - 1]`, e.g. after the list got shorter. `0` for an empty list. */
export function clampIndex(index: number, length: number): number {
  return length > 0 ? Math.max(0, Math.min(index, length - 1)) : 0
}
