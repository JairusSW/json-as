// Scalar RFC 8259 syntax validator used by strict builds. It keeps an explicit
// container-state stack so hostile nesting is rejected without recursing
// through the Wasm call stack. This is intentionally a cold correctness pass:
// optimized backends retain their existing scanners, and the compile-time
// JSON_STRICT guard removes this pass entirely from normal builds.

const ARRAY_FIRST_OR_END: u8 = 0;
const ARRAY_VALUE: u8 = 1;
const ARRAY_COMMA_OR_END: u8 = 2;
const OBJECT_FIRST_KEY_OR_END: u8 = 3;
const OBJECT_KEY: u8 = 4;
const OBJECT_COLON: u8 = 5;
const OBJECT_VALUE: u8 = 6;
const OBJECT_COMMA_OR_END: u8 = 7;
// RFC 8259 permits implementations to set a maximum nesting depth. Keep the
// limit below typical Wasm shadow-stack exhaustion while accepting practical
// documents and reporting excessive nesting as a normal parse error.
const MAX_JSON_DEPTH: i32 = 256;
// Validation completes before target-specific parsing begins, so a single
// fixed scratch stack is sufficient and avoids allocating a managed Array for
// every strict parse. The public parser is already synchronous; a custom
// deserializer can only start a nested parse after this pass has returned.
// @ts-expect-error: decorator is valid for module-level scratch storage
@lazy const JSON_STATE_STACK = new StaticArray<u8>(MAX_JSON_DEPTH);
let jsonStateDepth: i32 = 0;

// Four UTF-16 lanes per word. These masks only identify candidates; every hit
// is re-read as u16 before it can affect validation, so lane-borrow false
// positives are harmless while plain string runs advance eight bytes at once.
const JSON_LANE_ONES: u64 = 0x0001_0001_0001_0001;
const JSON_LANE_HI: u64 = 0x0080_0080_0080_0080;
const JSON_QUOTE_SPLAT: u64 = 0x0022_0022_0022_0022;
const JSON_SLASH_SPLAT: u64 = 0x005c_005c_005c_005c;
const JSON_CONTROL_MASK: u64 = 0xffe0_ffe0_ffe0_ffe0;


@inline
function jsonEqualPart(block: u64, splat: u64): u64 {
  const diff = block ^ splat;
  return (diff - JSON_LANE_ONES) & ~diff;
}


@inline
function jsonStringSpecialMask(block: u64): u64 {
  return (
    (jsonEqualPart(block, JSON_QUOTE_SPLAT) |
      jsonEqualPart(block, JSON_SLASH_SPLAT) |
      jsonEqualPart(block & JSON_CONTROL_MASK, 0)) &
    JSON_LANE_HI
  );
}


@inline
function isJSONWhitespace(code: u16): bool {
  return code == 0x20 || code == 0x09 || code == 0x0a || code == 0x0d;
}


@inline
function isDigit(code: u16): bool {
  return code >= 0x30 && code <= 0x39;
}


@inline
function isHexDigit(code: u16): bool {
  return (
    isDigit(code) ||
    (code >= 0x41 && code <= 0x46) ||
    (code >= 0x61 && code <= 0x66)
  );
}

function skipJSONWhitespace(ptr: usize, end: usize): usize {
  while (ptr < end && isJSONWhitespace(load<u16>(ptr))) ptr += 2;
  return ptr;
}

function scanJSONString(ptr: usize, end: usize): usize {
  if (ptr >= end || load<u16>(ptr) != 0x22) return 0;
  ptr += 2;
  const end8 = end >= 8 ? end - 8 : 0;

  while (ptr < end) {
    while (ptr <= end8) {
      const mask = jsonStringSpecialMask(load<u64>(ptr));
      if (!mask) {
        ptr += 8;
        continue;
      }

      const candidate = ptr + (usize(ctz(mask)) >> 3);
      const code = load<u16>(candidate);
      if (code == 0x22) return candidate + 2;
      if (code < 0x20) return 0;
      if (code != 0x5c) {
        // A non-ASCII lane may collide with the filter's low bits.
        ptr = candidate + 2;
        continue;
      }
      ptr = candidate;
      break;
    }

    if (ptr >= end) return 0;
    const code = load<u16>(ptr);
    if (code == 0x22) return ptr + 2;
    if (code < 0x20) return 0;

    if (code == 0x5c) {
      ptr += 2;
      if (ptr >= end) return 0;
      const escape = load<u16>(ptr);
      if (escape == 0x75) {
        if (ptr + 10 > end) return 0;
        if (
          !isHexDigit(load<u16>(ptr, 2)) ||
          !isHexDigit(load<u16>(ptr, 4)) ||
          !isHexDigit(load<u16>(ptr, 6)) ||
          !isHexDigit(load<u16>(ptr, 8))
        )
          return 0;
        ptr += 10;
        continue;
      }
      if (
        escape != 0x22 &&
        escape != 0x5c &&
        escape != 0x2f &&
        escape != 0x62 &&
        escape != 0x66 &&
        escape != 0x6e &&
        escape != 0x72 &&
        escape != 0x74
      )
        return 0;
    }

    ptr += 2;
  }

  return 0;
}

function scanJSONNumber(ptr: usize, end: usize): usize {
  if (ptr < end && load<u16>(ptr) == 0x2d) ptr += 2;
  if (ptr >= end) return 0;

  let code = load<u16>(ptr);
  if (code == 0x30) {
    ptr += 2;
    if (ptr < end && isDigit(load<u16>(ptr))) return 0;
  } else if (code >= 0x31 && code <= 0x39) {
    do {
      ptr += 2;
    } while (ptr < end && isDigit(load<u16>(ptr)));
  } else {
    return 0;
  }

  if (ptr < end && load<u16>(ptr) == 0x2e) {
    ptr += 2;
    if (ptr >= end || !isDigit(load<u16>(ptr))) return 0;
    do {
      ptr += 2;
    } while (ptr < end && isDigit(load<u16>(ptr)));
  }

  if (ptr < end) {
    code = load<u16>(ptr);
    if (code == 0x65 || code == 0x45) {
      ptr += 2;
      if (ptr < end) {
        code = load<u16>(ptr);
        if (code == 0x2b || code == 0x2d) ptr += 2;
      }
      if (ptr >= end || !isDigit(load<u16>(ptr))) return 0;
      do {
        ptr += 2;
      } while (ptr < end && isDigit(load<u16>(ptr)));
    }
  }

  return ptr;
}

function scanLiteral(
  ptr: usize,
  end: usize,
  a: u16,
  b: u16,
  c: u16,
  d: u16,
  e: u16 = 0,
): usize {
  const byteLength: usize = e ? 10 : 8;
  if (ptr + byteLength > end) return 0;
  if (
    load<u16>(ptr) != a ||
    load<u16>(ptr, 2) != b ||
    load<u16>(ptr, 4) != c ||
    load<u16>(ptr, 6) != d ||
    (e && load<u16>(ptr, 8) != e)
  )
    return 0;
  return ptr + byteLength;
}

function scanJSONValue(ptr: usize, end: usize): usize {
  if (ptr >= end) return 0;
  const code = load<u16>(ptr);
  if (code == 0x22) return scanJSONString(ptr, end);
  if (code == 0x5b) {
    if (jsonStateDepth >= MAX_JSON_DEPTH) return 0;
    unchecked((JSON_STATE_STACK[jsonStateDepth++] = ARRAY_FIRST_OR_END));
    return ptr + 2;
  }
  if (code == 0x7b) {
    if (jsonStateDepth >= MAX_JSON_DEPTH) return 0;
    unchecked((JSON_STATE_STACK[jsonStateDepth++] = OBJECT_FIRST_KEY_OR_END));
    return ptr + 2;
  }
  if (code == 0x74) return scanLiteral(ptr, end, 0x74, 0x72, 0x75, 0x65); // true
  if (code == 0x66) return scanLiteral(ptr, end, 0x66, 0x61, 0x6c, 0x73, 0x65); // false
  if (code == 0x6e) return scanLiteral(ptr, end, 0x6e, 0x75, 0x6c, 0x6c); // null
  return scanJSONNumber(ptr, end);
}

// JSONTestSuite's implementation-defined UTF-16-without-BOM fixtures arrive
// in an AssemblyScript string as alternating byte-valued code units. Recover
// the intended UTF-16 code units before validating or dispatching them.
export function normalizeJSONEncoding(data: string): string {
  const length = data.length;
  if (length < 4) return data;

  let byteIndex = -1;
  if (data.charCodeAt(0) == 0) {
    byteIndex = 0; // UTF-16BE bytes: NUL, code unit, NUL, code unit, ...
  } else if (data.charCodeAt(1) == 0) {
    byteIndex = 1; // UTF-16LE bytes: code unit, NUL, code unit, NUL, ...
  } else {
    return data;
  }

  for (let i = byteIndex; i < length; i += 2) {
    if (data.charCodeAt(i) != 0) return data;
  }

  let out = "";
  const codeIndex = byteIndex ^ 1;
  for (let i = codeIndex; i < length; i += 2)
    out += String.fromCharCode(data.charCodeAt(i));
  return out;
}

export function validateJSON(data: string): bool {
  let ptr = changetype<usize>(data);
  const end = ptr + ((<usize>data.length) << 1);
  ptr = skipJSONWhitespace(ptr, end);
  if (ptr >= end) return false;

  jsonStateDepth = 0;
  ptr = scanJSONValue(ptr, end);
  if (!ptr) return false;
  let rootComplete = jsonStateDepth == 0;

  while (true) {
    ptr = skipJSONWhitespace(ptr, end);
    if (jsonStateDepth == 0) return rootComplete && ptr == end;
    if (ptr >= end) return false;

    const top = jsonStateDepth - 1;
    const state = unchecked(JSON_STATE_STACK[top]);
    const code = load<u16>(ptr);

    if (state == ARRAY_FIRST_OR_END) {
      if (code == 0x5d) {
        jsonStateDepth--;
        ptr += 2;
        if (jsonStateDepth == 0) rootComplete = true;
      } else {
        unchecked((JSON_STATE_STACK[top] = ARRAY_COMMA_OR_END));
        ptr = scanJSONValue(ptr, end);
        if (!ptr) return false;
      }
    } else if (state == ARRAY_VALUE) {
      unchecked((JSON_STATE_STACK[top] = ARRAY_COMMA_OR_END));
      ptr = scanJSONValue(ptr, end);
      if (!ptr) return false;
    } else if (state == ARRAY_COMMA_OR_END) {
      if (code == 0x2c) {
        unchecked((JSON_STATE_STACK[top] = ARRAY_VALUE));
        ptr += 2;
      } else if (code == 0x5d) {
        jsonStateDepth--;
        ptr += 2;
        if (jsonStateDepth == 0) rootComplete = true;
      } else {
        return false;
      }
    } else if (state == OBJECT_FIRST_KEY_OR_END) {
      if (code == 0x7d) {
        jsonStateDepth--;
        ptr += 2;
        if (jsonStateDepth == 0) rootComplete = true;
      } else {
        ptr = scanJSONString(ptr, end);
        if (!ptr) return false;
        unchecked((JSON_STATE_STACK[top] = OBJECT_COLON));
      }
    } else if (state == OBJECT_KEY) {
      ptr = scanJSONString(ptr, end);
      if (!ptr) return false;
      unchecked((JSON_STATE_STACK[top] = OBJECT_COLON));
    } else if (state == OBJECT_COLON) {
      if (code != 0x3a) return false;
      unchecked((JSON_STATE_STACK[top] = OBJECT_VALUE));
      ptr += 2;
    } else if (state == OBJECT_VALUE) {
      unchecked((JSON_STATE_STACK[top] = OBJECT_COMMA_OR_END));
      ptr = scanJSONValue(ptr, end);
      if (!ptr) return false;
    } else {
      if (code == 0x2c) {
        unchecked((JSON_STATE_STACK[top] = OBJECT_KEY));
        ptr += 2;
      } else if (code == 0x7d) {
        jsonStateDepth--;
        ptr += 2;
        if (jsonStateDepth == 0) rootComplete = true;
      } else {
        return false;
      }
    }
  }
}
