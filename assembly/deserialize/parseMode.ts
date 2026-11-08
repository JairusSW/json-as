import { linkObject } from "../util/runtime";
let SIMD_PRETTY_PARSE = false;
const ENABLE_EXACT_SOURCE_TRACES = true;
// The generated cursor path builds a new, unpublished object graph entirely
// inside the runtime's allocation batch. No old object can point at one of
// these children yet, so incremental-GC write barriers are redundant until
// the root is published. A depth counter keeps nested public parses safe.
let CURSOR_FRESH_GRAPH_DEPTH = 0;


@inline
export function beginCursorFreshGraph(): void {
  CURSOR_FRESH_GRAPH_DEPTH++;
}


@inline
export function endCursorFreshGraph(): void {
  CURSOR_FRESH_GRAPH_DEPTH--;
}


@inline
export function cursorLink(
  parent: usize,
  child: usize,
  expectMultiple: bool = false,
): void {
  if (CURSOR_FRESH_GRAPH_DEPTH == 0) linkObject(parent, child, expectMultiple);
}

// Steady-state SIMD string-field trace. JSON source strings and parsed field
// strings are immutable at the language level, so the tuple
// (source position, destination slot, current string reference) proves that a
// field still contains the bytes produced by the prior parse. Any mutation or
// graph replacement changes at least one tuple component and takes the normal
// decoder, which refreshes that trace slot.
// Bound strong source/decoded-string retention between public calls.
const STRING_TRACE_MAX_BYTES: usize = 256 * 1024;
let STRING_TRACE_RETAINED_BYTES: usize = 0;
let STRING_TRACE_DEPTH = 0;
let STRING_TRACE_ACTIVE = false;
let STRING_TRACE_COMPLETE = false;
let STRING_TRACE_SOURCE: string | null = null;
let STRING_TRACE_OUT: usize = 0;
let STRING_TRACE_TYPE: u32 = 0;
let STRING_TRACE_INDEX = 0;
let STRING_TRACE_COUNT = 0;
let STRING_TRACE_SLOT = 0;
const STRING_TRACE_FIELDS = new Array<usize>();
const STRING_TRACE_STARTS = new Array<usize>();
const STRING_TRACE_ENDS = new Array<usize>();
const STRING_TRACE_VALUES = new Array<string>();
let OBJECT_TRACE_INDEX = 0;
let OBJECT_TRACE_COUNT = 0;
const OBJECT_TRACE_FIELDS = new Array<usize>();
const OBJECT_TRACE_STARTS = new Array<usize>();
const OBJECT_TRACE_TYPES = new Array<string>();
const OBJECT_TRACE_MASKS = new Array<u64>();
const OBJECT_TRACE_TIERS = new Array<u8>();
const OBJECT_TRACE_SEPARATORS = new Array<usize>();


@inline
export function isPrettyParse(): bool {
  return SIMD_PRETTY_PARSE;
}


@inline
export function setPrettyParse(value: bool): void {
  SIMD_PRETTY_PARSE = value;
}

/** Reused string buffers can be cached sources or decoded field values. */
export function invalidateStringFieldTrace(
  value: usize,
  ownedOutput: bool = false,
): void {
  if (!ENABLE_EXACT_SOURCE_TRACES) return;
  // A public stringify can overwrite either a cached source or decoded field.
  // A different top-level parse already resets the single-root cache at entry;
  // its ordinary field writes should not disrupt newly recorded trace slots.
  // Nested parses can mutate the enclosing parse's graph and must suspend it.
  if (
    !ownedOutput &&
    STRING_TRACE_DEPTH <= 1 &&
    value != changetype<usize>(STRING_TRACE_SOURCE)
  )
    return;
  // Also suspend probes in a reentrant parse. Clearing the source guarantees
  // the next public parse rebuilds both string and object trace slots.
  clearStringFieldTrace();
}

// One parse may overwrite each managed string through only one destination
// slot. Nested parses share these claims; duplicate keys in one slot may reuse.
let STRING_BUFFER_OWNERS: Map<usize, usize> | null = null;
// Active inputs cannot be writable destinations, even when also reachable from out.
const ACTIVE_PARSE_SOURCES = new Array<string>(8);
let ACTIVE_PARSE_ROOT: string | null = null;
let ACTIVE_PARSE_OUT: usize = 0;

// Small output graphs avoid managed Map allocation and hashing.
// Each bucket stores raw (allocation, destination, generation) metadata; the
// active source and caller's output graph retain the actual managed values.
// Keep at most half the buckets occupied so probes remain bounded. Larger
// graphs migrate their claims to the existing Map fallback.
const OWNER_BUCKET_BITS: i32 = 8;
const OWNER_BUCKET_COUNT: i32 = 1 << OWNER_BUCKET_BITS;
const OWNER_INLINE_LIMIT: i32 = OWNER_BUCKET_COUNT / 2;
const OWNER_SLOT_BYTES: usize = 3 * sizeof<usize>();
const SMALL_OWNERS: usize = memory.data(OWNER_BUCKET_COUNT * OWNER_SLOT_BYTES);
let SMALL_OWNER_COUNT: i32 = 0;
// Zero denotes an unused bucket, including before any public parse scope.
let OWNER_GENERATION: u32 = 1;

@inline
function resetBufferOwners(): void {
  SMALL_OWNER_COUNT = 0;
  // Invalidate all buckets in O(1); clear tags only when the epoch wraps.
  if (++OWNER_GENERATION == 0) {
    memory.fill(SMALL_OWNERS, 0, OWNER_BUCKET_COUNT * OWNER_SLOT_BYTES);
    OWNER_GENERATION = 1;
  }
  if (!STRING_BUFFER_OWNERS) return;
  const ptr = changetype<usize>(STRING_BUFFER_OWNERS);
  if (load<i32>(ptr, offsetof<Map<usize, usize>>("entriesCount")) == 0) return;
  const buckets = load<usize>(ptr, offsetof<Map<usize, usize>>("buckets"));
  const mask = load<u32>(ptr, offsetof<Map<usize, usize>>("bucketsMask"));
  memory.fill(buckets, 0, (<usize>mask + 1) * sizeof<usize>());
  store<i32>(ptr, 0, offsetof<Map<usize, usize>>("entriesOffset"));
  store<i32>(ptr, 0, offsetof<Map<usize, usize>>("entriesCount"));
}

@inline
export function claimStringBuffer(value: usize, field: usize): bool {
  if (value == changetype<usize>(ACTIVE_PARSE_ROOT)) return false;
  if (ACTIVE_PARSE_OUT && value == ACTIVE_PARSE_OUT) return field == 0;
  for (let i = 1; i < STRING_TRACE_DEPTH; i++) {
    if (value == changetype<usize>(unchecked(ACTIVE_PARSE_SOURCES[i])))
      return false;
  }
  if (SMALL_OWNER_COUNT >= 0) {
    let slot: u32 = ((u32(value) >> 4) * 0x9e3779b1) >> (32 - OWNER_BUCKET_BITS);
    while (true) {
      const ptr = SMALL_OWNERS + usize(slot) * OWNER_SLOT_BYTES;
      if (load<u32>(ptr, 2 * sizeof<usize>()) != OWNER_GENERATION) {
        if (SMALL_OWNER_COUNT >= OWNER_INLINE_LIMIT) break;
        store<usize>(ptr, value);
        store<usize>(ptr, field, sizeof<usize>());
        store<u32>(ptr, OWNER_GENERATION, 2 * sizeof<usize>());
        SMALL_OWNER_COUNT++;
        return true;
      }
      if (load<usize>(ptr) == value)
        return load<usize>(ptr, sizeof<usize>()) == field;
      slot = (slot + 1) & (OWNER_BUCKET_COUNT - 1);
    }
  }
  return claimStringBufferSlow(value, field);
}

function claimStringBufferSlow(value: usize, field: usize): bool {
  if (!STRING_BUFFER_OWNERS) STRING_BUFFER_OWNERS = new Map<usize, usize>();
  const owners = STRING_BUFFER_OWNERS!;
  if (SMALL_OWNER_COUNT >= 0) {
    for (let i = 0; i < OWNER_BUCKET_COUNT; i++) {
      const ptr = SMALL_OWNERS + usize(i) * OWNER_SLOT_BYTES;
      if (load<u32>(ptr, 2 * sizeof<usize>()) == OWNER_GENERATION)
        owners.set(load<usize>(ptr), load<usize>(ptr, sizeof<usize>()));
    }
    SMALL_OWNER_COUNT = -1;
  }
  if (owners.has(value)) return owners.get(value) == field;
  owners.set(value, field);
  return true;
}
@inline export function hasCompositeReuseScope(): bool {
  return STRING_TRACE_DEPTH != 0;
}

/** Claim a composite allocation for one logical field in the current parse.
 * Repeated keys targeting that same field may continue reusing it. */
export function reuseComposite(value: usize, field: usize): usize {
  return value != 0 && claimStringBuffer(value, field) ? value : 0;
}

/** Distinct views can still alias one writable backing allocation. Claim that
 * allocation as well as the wrapper before decoding into existing storage. */
@inline
export function claimTypedArrayStorage(value: usize): bool {
  if (!hasCompositeReuseScope()) return true;
  return claimStringBuffer(
    load<usize>(value, offsetof<ArrayBufferView>("buffer")),
    value,
  );
}

/** Drop the optional exact-source cache without changing active parse nesting. */
@inline
export function clearStringFieldTrace(): void {
  STRING_TRACE_SOURCE = null;
  STRING_TRACE_OUT = 0;
  STRING_TRACE_COMPLETE = false;
  STRING_TRACE_ACTIVE = false;
  if (load<i32>(changetype<usize>(STRING_TRACE_VALUES), offsetof<Array<string>>("length_")))
    STRING_TRACE_VALUES.length = 0;
  if (load<i32>(changetype<usize>(OBJECT_TRACE_TYPES), offsetof<Array<string>>("length_")))
    OBJECT_TRACE_TYPES.length = 0;
  STRING_TRACE_COUNT = 0;
  OBJECT_TRACE_COUNT = 0;
  STRING_TRACE_RETAINED_BYTES = 0;
}

/** Enter one public parse call, suspending trace use in nested parses. */
@inline
export function beginStringFieldTrace(
  source: string,
  out: usize,
  typeId: u32,
): void {
  if (!ENABLE_EXACT_SOURCE_TRACES) return;
  if (STRING_TRACE_DEPTH == 0) resetBufferOwners();

  const sourcePtr = changetype<usize>(source);
  if (STRING_TRACE_DEPTH == 0) {
    ACTIVE_PARSE_ROOT = source;
    ACTIVE_PARSE_OUT = out;
  } else {
    if (STRING_TRACE_DEPTH >= ACTIVE_PARSE_SOURCES.length)
      ACTIVE_PARSE_SOURCES.length = STRING_TRACE_DEPTH + 1;
    unchecked((ACTIVE_PARSE_SOURCES[STRING_TRACE_DEPTH] = source));
  }
  STRING_TRACE_DEPTH++;
  if (!ASC_FEATURE_SIMD || STRING_TRACE_DEPTH != 1) return;
  if (out == 0 || (<usize>source.length) << 1 > STRING_TRACE_MAX_BYTES) {
    clearStringFieldTrace();
    return;
  }

  const sameRoot =
    STRING_TRACE_COMPLETE &&
    STRING_TRACE_OUT == out &&
    STRING_TRACE_TYPE == typeId &&
    changetype<usize>(STRING_TRACE_SOURCE) == sourcePtr;
  if (!sameRoot) {
    STRING_TRACE_SOURCE = source;
    STRING_TRACE_RETAINED_BYTES = (<usize>source.length) << 1;
    STRING_TRACE_OUT = out;
    STRING_TRACE_TYPE = typeId;
    STRING_TRACE_COUNT = 0;
    if (load<i32>(changetype<usize>(STRING_TRACE_FIELDS), offsetof<Array<usize>>("length_")))
    STRING_TRACE_FIELDS.length = 0;
    if (load<i32>(changetype<usize>(STRING_TRACE_STARTS), offsetof<Array<usize>>("length_")))
    STRING_TRACE_STARTS.length = 0;
    if (load<i32>(changetype<usize>(STRING_TRACE_ENDS), offsetof<Array<usize>>("length_")))
    STRING_TRACE_ENDS.length = 0;
    if (load<i32>(changetype<usize>(STRING_TRACE_VALUES), offsetof<Array<string>>("length_")))
    STRING_TRACE_VALUES.length = 0;
    OBJECT_TRACE_COUNT = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_FIELDS), offsetof<Array<usize>>("length_")))
    OBJECT_TRACE_FIELDS.length = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_STARTS), offsetof<Array<usize>>("length_")))
    OBJECT_TRACE_STARTS.length = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_TYPES), offsetof<Array<string>>("length_")))
    OBJECT_TRACE_TYPES.length = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_MASKS), offsetof<Array<u64>>("length_")))
    OBJECT_TRACE_MASKS.length = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_TIERS), offsetof<Array<u8>>("length_")))
    OBJECT_TRACE_TIERS.length = 0;
    if (load<i32>(changetype<usize>(OBJECT_TRACE_SEPARATORS), offsetof<Array<usize>>("length_")))
    OBJECT_TRACE_SEPARATORS.length = 0;
  }
  STRING_TRACE_INDEX = 0;
  OBJECT_TRACE_INDEX = 0;
  STRING_TRACE_COMPLETE = false;
  // The first successful parse remembers only the candidate identity. Record
  // slots on a repeated source/output pair, then probe them on later repeats.
  // Changing requests otherwise pay to build metadata they will never reuse.
  STRING_TRACE_ACTIVE = sameRoot;
}

/** Leave the matching public parse call. */
@inline
export function endStringFieldTrace(success: bool): void {
  if (!ENABLE_EXACT_SOURCE_TRACES) return;
  if (STRING_TRACE_DEPTH == 1) {
    STRING_TRACE_ACTIVE = false;
    STRING_TRACE_COMPLETE = success;
  }
  STRING_TRACE_DEPTH--;
  if (STRING_TRACE_DEPTH == 0) {
    ACTIVE_PARSE_ROOT = null;
    ACTIVE_PARSE_OUT = 0;
    resetBufferOwners();
  } else {
    unchecked((ACTIVE_PARSE_SOURCES[STRING_TRACE_DEPTH] = changetype<string>(0)));
  }
}

/** Return the cached cursor, or zero when this field must be decoded. */
@inline
export function probeStringFieldTrace(
  dstFieldPtr: usize,
  payloadStart: usize,
): usize {
  if (!ENABLE_EXACT_SOURCE_TRACES) return 0;
  if (!STRING_TRACE_ACTIVE || STRING_TRACE_DEPTH != 1) return 0;
  const slot = STRING_TRACE_INDEX++;
  STRING_TRACE_SLOT = slot;
  if (
    slot < STRING_TRACE_COUNT &&
    unchecked(STRING_TRACE_FIELDS[slot]) == dstFieldPtr &&
    unchecked(STRING_TRACE_STARTS[slot]) == payloadStart &&
    load<usize>(dstFieldPtr) ==
      changetype<usize>(unchecked(STRING_TRACE_VALUES[slot]))
  ) {
    if (!claimStringBuffer(load<usize>(dstFieldPtr), dstFieldPtr)) return 0;
    return unchecked(STRING_TRACE_ENDS[slot]);
  }
  return 0;
}

/** Record the successful decode corresponding to the most recent probe. */
@inline
export function recordStringFieldTrace(
  dstFieldPtr: usize,
  payloadStart: usize,
  next: usize,
): void {
  if (!ENABLE_EXACT_SOURCE_TRACES) return;
  if (!STRING_TRACE_ACTIVE || STRING_TRACE_DEPTH != 1) return;
  const slot = STRING_TRACE_SLOT;
  const value = load<string>(dstFieldPtr);
  if (slot < STRING_TRACE_COUNT)
    STRING_TRACE_RETAINED_BYTES -=
      ((<usize>unchecked(STRING_TRACE_VALUES[slot]).length) << 1) + 16;
  STRING_TRACE_RETAINED_BYTES += ((<usize>value.length) << 1) + 16;
  if (STRING_TRACE_RETAINED_BYTES > STRING_TRACE_MAX_BYTES) {
    clearStringFieldTrace();
    return;
  }
  if (slot < STRING_TRACE_COUNT) {
    unchecked((STRING_TRACE_FIELDS[slot] = dstFieldPtr));
    unchecked((STRING_TRACE_STARTS[slot] = payloadStart));
    unchecked((STRING_TRACE_ENDS[slot] = next));
    unchecked((STRING_TRACE_VALUES[slot] = value));
  } else {
    STRING_TRACE_FIELDS.push(dstFieldPtr);
    STRING_TRACE_STARTS.push(payloadStart);
    STRING_TRACE_ENDS.push(next);
    STRING_TRACE_VALUES.push(value);
    STRING_TRACE_COUNT = slot + 1;
  }
}

/**
 * Reserve or find one optional-struct trace slot.
 *
 * Returns i32.MIN_VALUE when tracing is inactive, a non-negative slot on a
 * miss, or `~slot` (negative) on a hit. Reserving at begin keeps nested object
 * records well-ordered even though a parent only commits after its children.
 */
@inline
export function beginObjectFieldTrace(
  dst: usize,
  srcStart: usize,
  typeTag: string,
): i32 {
  if (!ENABLE_EXACT_SOURCE_TRACES) return i32.MIN_VALUE;
  if (!STRING_TRACE_ACTIVE || STRING_TRACE_DEPTH != 1) return i32.MIN_VALUE;
  const slot = OBJECT_TRACE_INDEX++;
  if (
    slot < OBJECT_TRACE_COUNT &&
    unchecked(OBJECT_TRACE_FIELDS[slot]) == dst &&
    unchecked(OBJECT_TRACE_STARTS[slot]) == srcStart &&
    unchecked(OBJECT_TRACE_TIERS[slot]) != 0 &&
    changetype<usize>(unchecked(OBJECT_TRACE_TYPES[slot])) ==
      changetype<usize>(typeTag)
  )
    return ~slot;

  if (slot < OBJECT_TRACE_COUNT) {
    unchecked((OBJECT_TRACE_FIELDS[slot] = dst));
    unchecked((OBJECT_TRACE_STARTS[slot] = srcStart));
    unchecked((OBJECT_TRACE_TYPES[slot] = typeTag));
    unchecked((OBJECT_TRACE_MASKS[slot] = 0));
    unchecked((OBJECT_TRACE_TIERS[slot] = 0));
    unchecked((OBJECT_TRACE_SEPARATORS[slot] = 0));
  } else {
    STRING_TRACE_RETAINED_BYTES += 32;
    if (STRING_TRACE_RETAINED_BYTES > STRING_TRACE_MAX_BYTES) {
      clearStringFieldTrace();
      return i32.MIN_VALUE;
    }
    OBJECT_TRACE_FIELDS.push(dst);
    OBJECT_TRACE_STARTS.push(srcStart);
    OBJECT_TRACE_TYPES.push(typeTag);
    OBJECT_TRACE_MASKS.push(0);
    OBJECT_TRACE_TIERS.push(0);
    OBJECT_TRACE_SEPARATORS.push(0);
    OBJECT_TRACE_COUNT = slot + 1;
  }
  return slot;
}


@inline
export function objectFieldTraceMask(slot: i32): u64 {
  return unchecked(OBJECT_TRACE_MASKS[slot]);
}


@inline
export function objectFieldTraceTier(slot: i32): u8 {
  return unchecked(OBJECT_TRACE_TIERS[slot]);
}


@inline
export function objectFieldTraceSeparator(slot: i32): usize {
  return unchecked(OBJECT_TRACE_SEPARATORS[slot]);
}


@inline
export function recordObjectFieldTrace(
  slot: i32,
  present: u64,
  tier: u8,
  separator: usize = 0,
): void {
  if (slot < 0 || slot >= OBJECT_TRACE_COUNT) return;
  unchecked((OBJECT_TRACE_MASKS[slot] = present));
  unchecked((OBJECT_TRACE_TIERS[slot] = tier));
  unchecked((OBJECT_TRACE_SEPARATORS[slot] = separator));
}
