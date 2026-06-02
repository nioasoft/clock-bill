/** Fractional positioning for Kanban drag & drop. A reorder sets the moved
 *  row's `position` to the midpoint of its new neighbors, touching one row. */

/** Position assigned to the first card in an empty column. */
export const INITIAL_POSITION = 1000;
/** Gap used when inserting at the top or bottom of a column. */
export const POSITION_GAP = 1000;

/**
 * Compute a `position` for a card dropped between `before` (the neighbor above,
 * smaller position) and `after` (the neighbor below, larger position). Pass
 * `null` for a missing neighbor (top/bottom/empty column).
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return INITIAL_POSITION;
  if (before === null) return (after as number) - POSITION_GAP;
  if (after === null) return before + POSITION_GAP;
  return (before + after) / 2;
}
