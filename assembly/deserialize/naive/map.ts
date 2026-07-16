import { JSON } from "../..";
import {
  COMMA,
  BRACE_LEFT,
  QUOTE,
  BRACE_RIGHT,
  COLON,
} from "../../custom/chars";
import { isSpace } from "../../util";
import { scanValueEnd } from "../../util/scanValueEnd";
import { lastValueEnd, parseValue } from "./object";

function rawMapKeyEquals(key: string, start: usize, end: usize): bool {
  const byteLength = end - start;
  if (<usize>(key.length << 1) != byteLength) return false;
  const keyStart = changetype<usize>(key);
  let offset: usize = 0;
  while (offset + 8 <= byteLength) {
    if (load<u64>(keyStart + offset) != load<u64>(start + offset)) return false;
    offset += 8;
  }
  while (offset < byteLength) {
    if (load<u16>(keyStart + offset) != load<u16>(start + offset)) return false;
    offset += 2;
  }
  return true;
}

function deserializeMapKey<T>(
  start: usize,
  end: usize,
  reusableKey: string = "",
  canReuse: bool = false,
): T {
  if (isString<T>() && canReuse && rawMapKeyEquals(reusableKey, start, end)) {
    return changetype<T>(reusableKey);
  }
  // @ts-expect-error: exists
  const keyText = JSON.__deserialize<string>(start - 2, end + 2);
  if (isString<T>()) return changetype<T>(keyText);
  return JSON.parse<T>(keyText);
}

function removeStaleMapKeys<T extends Map<any, any>>(
  out: T,
  previousKeys: Array<indexof<T>>,
  seenKeys: Set<indexof<T>>,
  parsedKeyCount: i32,
): void {
  if (changetype<usize>(previousKeys) == 0) return;
  if (changetype<usize>(seenKeys) == 0 && parsedKeyCount == previousKeys.length)
    return;

  // The common case preserves key order and needs no Set. If the new object
  // changed shape/order (or contains duplicates), materialize the Set only on
  // that rare path. Keys before the first mismatch matched by construction.
  if (changetype<usize>(seenKeys) == 0) {
    seenKeys = new Set<indexof<T>>();
    const matchedPrefix = min<i32>(parsedKeyCount, previousKeys.length);
    for (let i = 0; i < matchedPrefix; i++) {
      seenKeys.add(unchecked(previousKeys[i]));
    }
  }
  for (let i = 0; i < previousKeys.length; i++) {
    const key = unchecked(previousKeys[i]);
    if (!seenKeys.has(key)) changetype<nonnull<T>>(out).delete(key);
  }
}

export function deserializeMap<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const reuseExisting = dst != 0;
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart - srcEnd == 0)
    throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACE_LEFT)
    throw new Error(
      "Expected '{' at start of object at position " +
        (srcEnd - srcStart).toString(),
    );
  if (load<u16>(srcEnd - 2) != BRACE_RIGHT)
    throw new Error(
      "Expected '}' at end of object at position " +
        (srcEnd - srcStart).toString(),
    );

  deserializeMapBody<T>(srcStart, srcEnd, changetype<T>(out), reuseExisting);
  return changetype<T>(out);
}

/**
 * Shared single-pass map-body parser used by both the top-level and struct-field
 * entry points. Dynamic `JSON.Value` values are parsed in one pass via
 * {@link parseValue}; typed values are bounds-scanned with {@link scanValueEnd}
 * because their generated deserializers take exact `(start, end)` bounds.
 */
export function deserializeMapBody<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
  reuseExisting: bool = false,
): usize {
  let arbitraryValue = false;
  if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    // @ts-ignore: instanceof on the (reference) value type
    arbitraryValue = changetype<nonnull<valueof<T>>>(0) instanceof JSON.Value;
  }

  const previousKeys = reuseExisting
    ? changetype<nonnull<T>>(out).keys()
    : changetype<Array<indexof<T>>>(0);
  let seenKeys = changetype<Set<indexof<T>>>(0);
  let parsedKeyCount = 0;

  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACE_LEFT)
    throw new Error("Failed to parse JSON!");
  srcStart += 2;
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) throw new Error("Failed to parse JSON!");
  if (load<u16>(srcStart) == BRACE_RIGHT) {
    if (reuseExisting) changetype<nonnull<T>>(out).clear();
    return srcStart + 2;
  }

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) != QUOTE) break;

    const keyStart = srcStart + 2;
    const keyValueEnd = JSON.Util.scanValueEnd<string>(srcStart, srcEnd);
    if (!keyValueEnd) break;
    const keyEnd = keyValueEnd - 2;

    srcStart = keyEnd + 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd || load<u16>(srcStart) != COLON) break;
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;

    let reusableKey = "";
    const canReuseKey =
      isString<indexof<T>>() &&
      reuseExisting &&
      parsedKeyCount < previousKeys.length;
    if (canReuseKey) {
      reusableKey = changetype<string>(unchecked(previousKeys[parsedKeyCount]));
    }
    const key = deserializeMapKey<indexof<T>>(
      keyStart,
      keyEnd,
      reusableKey,
      canReuseKey,
    );
    if (reuseExisting) {
      if (
        changetype<usize>(seenKeys) == 0 &&
        (parsedKeyCount >= previousKeys.length ||
          key != unchecked(previousKeys[parsedKeyCount]))
      ) {
        seenKeys = new Set<indexof<T>>();
        for (let i = 0; i < parsedKeyCount; i++) {
          seenKeys.add(unchecked(previousKeys[i]));
        }
      }
      if (changetype<usize>(seenKeys) != 0) seenKeys.add(key);
      parsedKeyCount++;
    }

    if (isReference<valueof<T>>() && arbitraryValue) {
      const val = parseValue(srcStart, srcEnd);
      // @ts-ignore: type - valueof<T> is JSON.Value in this branch
      changetype<nonnull<T>>(out).set(
        key,
        changetype<valueof<T>>(changetype<usize>(val)),
      );
      srcStart = lastValueEnd();
    } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
      const valueType = changetype<nonnull<valueof<T>>>(0);
      if (
        // @ts-ignore: supplied by the json-as transform
        isDefined(valueType.__DESERIALIZE_FAST) ||
        // @ts-ignore: supplied by the json-as transform
        isDefined(valueType.__DESERIALIZE_SLOW)
      ) {
        // Dynamic-key object maps (GSOC/CITM-style corpora) previously scanned
        // every complete value to discover its end, then allocated and parsed
        // it in a second pass. Generated struct parsers already return the
        // cursor after `}`, so drive them directly and reuse a mapped instance
        // when the key was present in the destination map.
        let value = changetype<valueof<T>>(0);
        if (changetype<nonnull<T>>(out).has(key)) {
          value = changetype<nonnull<T>>(out).get(key);
        }
        if (changetype<usize>(value) == 0) {
          value = changetype<valueof<T>>(
            __new(offsetof<nonnull<valueof<T>>>(), idof<nonnull<valueof<T>>>()),
          );
          // @ts-ignore: supplied by the json-as transform
          if (isDefined(valueType.__INITIALIZE)) {
            // @ts-ignore: supplied by the json-as transform
            changetype<nonnull<valueof<T>>>(value).__INITIALIZE();
          }
        }

        const valueStart = srcStart;
        let next: usize = 0;
        // @ts-ignore: supplied by the json-as transform
        if (isDefined(valueType.__DESERIALIZE_FAST)) {
          // @ts-ignore: supplied by the json-as transform
          next = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST(
            srcStart,
            srcEnd,
            value,
          );
        }
        if (!next) {
          const valueEnd = scanValueEnd(valueStart, srcEnd);
          if (!valueEnd || valueEnd <= valueStart) break;
          // A failed FAST attempt may have partially overwritten fields.
          // @ts-ignore: supplied by the json-as transform
          if (isDefined(valueType.__INITIALIZE)) {
            // @ts-ignore: supplied by the json-as transform
            changetype<nonnull<valueof<T>>>(value).__INITIALIZE();
          }
          // @ts-ignore: supplied by the json-as transform
          changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_SLOW(
            valueStart,
            valueEnd,
            value,
          );
          next = valueEnd;
        }

        changetype<nonnull<T>>(out).set(key, value);
        srcStart = next;
      } else {
        const valueEnd = scanValueEnd(srcStart, srcEnd);
        if (!valueEnd || valueEnd <= srcStart) break;
        // @ts-ignore: type
        changetype<nonnull<T>>(out).set(
          key,
          JSON.__deserialize<valueof<T>>(srcStart, valueEnd),
        );
        srcStart = valueEnd;
      }
    } else {
      const valueEnd = scanValueEnd(srcStart, srcEnd);
      if (!valueEnd || valueEnd <= srcStart) break;
      // @ts-ignore: type
      changetype<nonnull<T>>(out).set(
        key,
        JSON.__deserialize<valueof<T>>(srcStart, valueEnd),
      );
      srcStart = valueEnd;
    }

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) {
      removeStaleMapKeys<T>(out, previousKeys, seenKeys, parsedKeyCount);
      return srcStart + 2;
    }
    break;
  }

  throw new Error("Failed to parse JSON!");
}

export function deserializeMapField<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  let out = load<T>(fieldPtr);
  const reuseExisting = changetype<usize>(out) != 0;
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  }
  return deserializeMapBody<T>(srcStart, srcEnd, out, reuseExisting);
}
