let SIMD_PRETTY_PARSE = false;

// Steady-state SIMD string-field trace. JSON source strings and parsed field
// strings are immutable at the language level, so the tuple
// (source position, destination slot, current string reference) proves that a
// field still contains the bytes produced by the prior parse. Any mutation or
// graph replacement changes at least one tuple component and takes the normal
// decoder, which refreshes that trace slot.
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

/** Enter one public parse call, suspending trace use in nested parses. */
@inline
export function beginStringFieldTrace(
  source: string,
  out: usize,
  typeId: u32,
): void {
  STRING_TRACE_DEPTH++;
  if (!ASC_FEATURE_SIMD || STRING_TRACE_DEPTH != 1 || out == 0) return;

  const sourcePtr = changetype<usize>(source);
  const sameRoot =
    STRING_TRACE_COMPLETE &&
    STRING_TRACE_OUT == out &&
    STRING_TRACE_TYPE == typeId &&
    changetype<usize>(STRING_TRACE_SOURCE) == sourcePtr;
  if (!sameRoot) {
    STRING_TRACE_SOURCE = source;
    STRING_TRACE_OUT = out;
    STRING_TRACE_TYPE = typeId;
    STRING_TRACE_COUNT = 0;
    STRING_TRACE_FIELDS.length = 0;
    STRING_TRACE_STARTS.length = 0;
    STRING_TRACE_ENDS.length = 0;
    STRING_TRACE_VALUES.length = 0;
    OBJECT_TRACE_COUNT = 0;
    OBJECT_TRACE_FIELDS.length = 0;
    OBJECT_TRACE_STARTS.length = 0;
    OBJECT_TRACE_TYPES.length = 0;
    OBJECT_TRACE_MASKS.length = 0;
    OBJECT_TRACE_TIERS.length = 0;
    OBJECT_TRACE_SEPARATORS.length = 0;
  }
  STRING_TRACE_INDEX = 0;
  OBJECT_TRACE_INDEX = 0;
  STRING_TRACE_COMPLETE = false;
  STRING_TRACE_ACTIVE = true;
}

/** Leave the matching public parse call. */
@inline
export function endStringFieldTrace(success: bool): void {
  if (STRING_TRACE_DEPTH == 1) {
    STRING_TRACE_ACTIVE = false;
    STRING_TRACE_COMPLETE = success;
  }
  STRING_TRACE_DEPTH--;
}

/** Return the cached cursor, or zero when this field must be decoded. */
@inline
export function probeStringFieldTrace(
  dstFieldPtr: usize,
  payloadStart: usize,
): usize {
  if (!STRING_TRACE_ACTIVE || STRING_TRACE_DEPTH != 1) return 0;
  const slot = STRING_TRACE_INDEX++;
  STRING_TRACE_SLOT = slot;
  if (
    slot < STRING_TRACE_COUNT &&
    unchecked(STRING_TRACE_FIELDS[slot]) == dstFieldPtr &&
    unchecked(STRING_TRACE_STARTS[slot]) == payloadStart &&
    load<usize>(dstFieldPtr) ==
      changetype<usize>(unchecked(STRING_TRACE_VALUES[slot]))
  )
    return unchecked(STRING_TRACE_ENDS[slot]);
  return 0;
}

/** Record the successful decode corresponding to the most recent probe. */
@inline
export function recordStringFieldTrace(
  dstFieldPtr: usize,
  payloadStart: usize,
  next: usize,
): void {
  if (!STRING_TRACE_ACTIVE || STRING_TRACE_DEPTH != 1) return;
  const slot = STRING_TRACE_SLOT;
  const value = load<string>(dstFieldPtr);
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
