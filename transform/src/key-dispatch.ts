export type KeyDispatch<T> =
  | { members: T[] }
  | {
      offset: number;
      pivot: number;
      left: KeyDispatch<T>;
      right: KeyDispatch<T>;
    };

/**
 * Narrow a same-length key group before its existing exact comparisons.
 * Small groups keep declaration order and generate exactly the old matcher.
 * Larger groups branch on a differing UTF-16 code unit. A branch halves the
 * remaining code-unit range, so lookup needs at most 16 tests per key unit,
 * followed by at most eight full comparisons (except identical aliases).
 * No hash collisions or runtime table allocations are involved.
 */
export function keyDispatch<T>(
  members: T[],
  key: (member: T) => string,
): KeyDispatch<T> {
  if (members.length <= 8) return { members };
  const sorted = members
    .map((member, order) => ({ member, key: key(member), order }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const build = (
    start: number,
    end: number,
    offset: number,
  ): KeyDispatch<T> => {
    const first = sorted[start].key;
    const last = sorted[end - 1].key;
    if (end - start <= 8 || first === last)
      return {
        members: sorted
          .slice(start, end)
          .sort((a, b) => a.order - b.order)
          .map((entry) => entry.member),
      };
    while (first.charCodeAt(offset) === last.charCodeAt(offset)) offset++;
    // Bisect the character range, rather than the member count: a skewed
    // prefix distribution must still make bounded progress at this offset.
    const pivot =
      (first.charCodeAt(offset) + last.charCodeAt(offset) + 1) >>> 1;
    let lo = start;
    let hi = end;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid].key.charCodeAt(offset) < pivot) lo = mid + 1;
      else hi = mid;
    }
    return {
      offset,
      pivot,
      left: build(start, lo, offset),
      right: build(lo, end, offset),
    };
  };
  return build(0, sorted.length, 0);
}
