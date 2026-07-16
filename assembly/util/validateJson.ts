// Scalar RFC 8259 syntax validator used by the strict NAIVE backend. It keeps
// an explicit container-state stack so hostile nesting is rejected without
// recursing through the Wasm call stack. This is intentionally a correctness
// pass: the optimized backends retain their existing scanners.

const ARRAY_FIRST_OR_END: u8 = 0;
const ARRAY_VALUE: u8 = 1;
const ARRAY_COMMA_OR_END: u8 = 2;
const OBJECT_FIRST_KEY_OR_END: u8 = 3;
const OBJECT_KEY: u8 = 4;
const OBJECT_COLON: u8 = 5;
const OBJECT_VALUE: u8 = 6;
const OBJECT_COMMA_OR_END: u8 = 7;


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

  while (ptr < end) {
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

function scanJSONValue(ptr: usize, end: usize, states: u8[]): usize {
  if (ptr >= end) return 0;
  const code = load<u16>(ptr);
  if (code == 0x22) return scanJSONString(ptr, end);
  if (code == 0x5b) {
    states.push(ARRAY_FIRST_OR_END);
    return ptr + 2;
  }
  if (code == 0x7b) {
    states.push(OBJECT_FIRST_KEY_OR_END);
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

  const states = new Array<u8>();
  ptr = scanJSONValue(ptr, end, states);
  if (!ptr) return false;
  let rootComplete = states.length == 0;

  while (true) {
    ptr = skipJSONWhitespace(ptr, end);
    if (states.length == 0) return rootComplete && ptr == end;
    if (ptr >= end) return false;

    const top = states.length - 1;
    const state = states[top];
    const code = load<u16>(ptr);

    if (state == ARRAY_FIRST_OR_END) {
      if (code == 0x5d) {
        states.pop();
        ptr += 2;
        if (states.length == 0) rootComplete = true;
      } else {
        states[top] = ARRAY_COMMA_OR_END;
        ptr = scanJSONValue(ptr, end, states);
        if (!ptr) return false;
      }
    } else if (state == ARRAY_VALUE) {
      states[top] = ARRAY_COMMA_OR_END;
      ptr = scanJSONValue(ptr, end, states);
      if (!ptr) return false;
    } else if (state == ARRAY_COMMA_OR_END) {
      if (code == 0x2c) {
        states[top] = ARRAY_VALUE;
        ptr += 2;
      } else if (code == 0x5d) {
        states.pop();
        ptr += 2;
        if (states.length == 0) rootComplete = true;
      } else {
        return false;
      }
    } else if (state == OBJECT_FIRST_KEY_OR_END) {
      if (code == 0x7d) {
        states.pop();
        ptr += 2;
        if (states.length == 0) rootComplete = true;
      } else {
        ptr = scanJSONString(ptr, end);
        if (!ptr) return false;
        states[top] = OBJECT_COLON;
      }
    } else if (state == OBJECT_KEY) {
      ptr = scanJSONString(ptr, end);
      if (!ptr) return false;
      states[top] = OBJECT_COLON;
    } else if (state == OBJECT_COLON) {
      if (code != 0x3a) return false;
      states[top] = OBJECT_VALUE;
      ptr += 2;
    } else if (state == OBJECT_VALUE) {
      states[top] = OBJECT_COMMA_OR_END;
      ptr = scanJSONValue(ptr, end, states);
      if (!ptr) return false;
    } else {
      if (code == 0x2c) {
        states[top] = OBJECT_KEY;
        ptr += 2;
      } else if (code == 0x7d) {
        states.pop();
        ptr += 2;
        if (states.length == 0) rootComplete = true;
      } else {
        return false;
      }
    }
  }
}
