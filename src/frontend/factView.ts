import { FunFact } from '../types/LiveStats'

/** How a part of a fact is highlighted. `text` is plain text. */
export type FactSegmentKind = 'text' | 'stat' | 'guest'

/** A part of a fact as the templates render it. */
export type FactSegmentView = { text: string; kind: FactSegmentKind }

/** A fun fact as the templates render it: the parts joined together give `text`. */
export type FactView = { text: string; segments: FactSegmentView[] }

function kindOf(kind: string | undefined): FactSegmentKind {
  return kind === 'stat' || kind === 'guest' ? kind : 'text'
}

/**
 * The parts to highlight in a fact. The backend sends `segments` that joined together equal `text`. An older backend,
 * or a hand-built fact, has none: the whole text is then one plain part. A kind other than `stat` or `guest` is shown
 * as plain text, because the backend may add kinds later.
 */
export function toFactView(fact: FunFact): FactView {
  const segments = fact.segments?.length
    ? fact.segments.map(({ text, kind }) => ({ text, kind: kindOf(kind) }))
    : [{ text: fact.text, kind: 'text' as const }]
  return { text: fact.text, segments }
}
