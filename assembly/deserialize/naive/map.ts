import { NativeMap } from "../../util/native-collections";
import { HASH } from "util/hash";
import { reuseComposite } from "../parseMode";
import { JSON } from "../..";
import {
  COMMA,
  BRACE_LEFT,
  QUOTE,
  BRACE_RIGHT,
  COLON,
  NULL_WORD_U64,
  BACK_SLASH,
} from "../../custom/chars";
import { isSpace } from "../../util";
import { scanValueEnd } from "../../util/scanValueEnd";
import { lastValueEnd, parseValue } from "./object";
import { deserializeRaw } from "./raw";
import { isPrettyParse } from "../parseMode";

const ALIAS_SCAN_LIMIT: i32 = 16;
const XXH32_P1: u32 = 2654435761;
const XXH32_P2: u32 = 2246822519;
const XXH32_P3: u32 = 3266489917;
const XXH32_P4: u32 = 668265263;
const XXH32_P5: u32 = 374761393;


@unmanaged
class ReusableMapEntry<K, V> {
  key: K;
  value: V;
  taggedNext: usize;
}


@inline
function reusableMapEntrySize<K, V>(): usize {
  const maxKV = sizeof<K>() > sizeof<V>() ? sizeof<K>() : sizeof<V>();
  const align = (maxKV > sizeof<usize>() ? maxKV : sizeof<usize>()) - 1;
  return (offsetof<ReusableMapEntry<K, V>>() + align) & ~align;
}


@inline
function mixMapKeyHash(hash: u32, word: u32): u32 {
  return rotl(hash + word * XXH32_P2, 13) * XXH32_P1;
}


@inline
function containsMapKeyEscape(word: u32): bool {
  const slash = word ^ 0x005c_005c;
  return ((slash - 0x0001_0001) & ~slash & 0x8000_8000) != 0;
}

/** Decodes an unescaped fresh string key while computing the runtime Map hash.
 * Returns `(hash << 32) | keyPointer`, or zero when an escape requires the
 * established decoder. */
function deserializeFreshStringMapKey(start: usize, end: usize): u64 {
  const byteLength = end - start;
  let hash = <u32>byteLength;
  let pos = start;

  if (byteLength >= 16) {
    let s1 = XXH32_P1 + XXH32_P2;
    let s2 = XXH32_P2;
    let s3: u32 = 0;
    let s4 = 0 - XXH32_P1;
    const blockEnd = end - 16;
    while (pos <= blockEnd) {
      const w0 = load<u32>(pos);
      const w1 = load<u32>(pos, 4);
      const w2 = load<u32>(pos, 8);
      const w3 = load<u32>(pos, 12);
      if (
        containsMapKeyEscape(w0) ||
        containsMapKeyEscape(w1) ||
        containsMapKeyEscape(w2) ||
        containsMapKeyEscape(w3)
      )
        return 0;
      s1 = mixMapKeyHash(s1, w0);
      s2 = mixMapKeyHash(s2, w1);
      s3 = mixMapKeyHash(s3, w2);
      s4 = mixMapKeyHash(s4, w3);
      pos += 16;
    }
    hash += rotl(s1, 1) + rotl(s2, 7) + rotl(s3, 12) + rotl(s4, 18);
  } else {
    hash += XXH32_P5;
  }

  const wordEnd = end - 4;
  while (pos <= wordEnd) {
    const word = load<u32>(pos);
    if (containsMapKeyEscape(word)) return 0;
    hash += word * XXH32_P3;
    hash = rotl(hash, 17) * XXH32_P4;
    pos += 4;
  }
  if (pos < end) {
    const code = load<u16>(pos);
    if (code == BACK_SLASH) return 0;
    hash += <u8>code * XXH32_P5;
    hash = rotl(hash, 11) * XXH32_P1;
    hash += <u8>(code >> 8) * XXH32_P5;
    hash = rotl(hash, 11) * XXH32_P1;
  }

  hash ^= hash >> 15;
  hash *= XXH32_P2;
  hash ^= hash >> 13;
  hash *= XXH32_P3;
  hash ^= hash >> 16;

  let keyPtr = changetype<usize>("");
  if (byteLength != 0) {
    keyPtr = __new(byteLength, idof<string>());
    memory.copy(keyPtr, start, byteLength);
  }
  return ((<u64>hash) << 32) | keyPtr;
}

/** Inserts into a fresh runtime Map with an already computed key hash. Returns
 * false only at a growth boundary, where ordinary `Map.set` performs rehash. */
function reusableMapValueSlot<T extends Map<any, any>>(
  out: T,
  key: indexof<T>,
): usize {
  const ptr = changetype<usize>(out);
  const buckets = load<usize>(
    ptr,
    offsetof<Map<indexof<T>, valueof<T>>>("buckets"),
  );
  const mask = load<u32>(
    ptr,
    offsetof<Map<indexof<T>, valueof<T>>>("bucketsMask"),
  );
  let entry = load<usize>(
    buckets + ((<usize>(HASH<indexof<T>>(key) & mask)) << alignof<usize>()),
  );
  while (entry) {
    const next = load<usize>(
      entry,
      offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
    );
    if (
      !(next & 1) &&
      load<indexof<T>>(
        entry,
        offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("key"),
      ) == key
    )
      return (
        entry + offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value")
      );
    entry = next & ~(<usize>1);
  }
  return 0;
}

function setFreshMapValuePrehashed<T extends Map<any, any>>(
  out: T,
  key: indexof<T>,
  value: valueof<T>,
  hash: u32,
): bool {
  const mapPtr = changetype<usize>(out);
  const buckets = load<ArrayBuffer>(
    mapPtr,
    offsetof<Map<indexof<T>, valueof<T>>>("buckets"),
  );
  const bucketMask = load<u32>(
    mapPtr,
    offsetof<Map<indexof<T>, valueof<T>>>("bucketsMask"),
  );
  const bucketPtr =
    changetype<usize>(buckets) +
    ((<usize>(hash & bucketMask)) << alignof<usize>());
  let entry = load<usize>(bucketPtr);
  while (entry != 0) {
    const taggedNext = load<usize>(
      entry,
      offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
    );
    if (
      (taggedNext & 1) == 0 &&
      load<indexof<T>>(
        entry,
        offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("key"),
      ) == key
    ) {
      store<valueof<T>>(
        entry,
        value,
        offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value"),
      );
      if (isManaged<valueof<T>>())
        __link(mapPtr, changetype<usize>(value), true);
      return true;
    }
    entry = taggedNext & ~(<usize>1);
  }

  const offset = load<i32>(
    mapPtr,
    offsetof<Map<indexof<T>, valueof<T>>>("entriesOffset"),
  );
  if (
    offset ==
    load<i32>(mapPtr, offsetof<Map<indexof<T>, valueof<T>>>("entriesCapacity"))
  )
    return false;
  const entries = load<ArrayBuffer>(
    mapPtr,
    offsetof<Map<indexof<T>, valueof<T>>>("entries"),
  );
  const entrySize = reusableMapEntrySize<indexof<T>, valueof<T>>();
  entry = changetype<usize>(entries) + <usize>offset * entrySize;
  store<indexof<T>>(
    entry,
    key,
    offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("key"),
  );
  if (isManaged<indexof<T>>()) __link(mapPtr, changetype<usize>(key), true);
  store<valueof<T>>(
    entry,
    value,
    offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value"),
  );
  if (isManaged<valueof<T>>()) __link(mapPtr, changetype<usize>(value), true);
  store<usize>(
    entry,
    load<usize>(bucketPtr),
    offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
  );
  store<usize>(bucketPtr, entry);
  store<i32>(
    mapPtr,
    offset + 1,
    offsetof<Map<indexof<T>, valueof<T>>>("entriesOffset"),
  );
  const count = load<i32>(
    mapPtr,
    offsetof<Map<indexof<T>, valueof<T>>>("entriesCount"),
  );
  store<i32>(
    mapPtr,
    count + 1,
    offsetof<Map<indexof<T>, valueof<T>>>("entriesCount"),
  );
  return true;
}

@inline
function setParsedMapValue<T extends Map<any, any>>(
  out: T,
  key: indexof<T>,
  value: valueof<T>,
  packedKey: u64,
): void {
  if (
    packedKey != 0 &&
    setFreshMapValuePrehashed<T>(out, key, value, <u32>(packedKey >> 32))
  )
    return;
  changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeSet(key, value);
}


@inline
function reusedMapValueEarlier<T extends Map<any, any>>(
  entry: usize,
  current: usize,
  entrySize: usize,
  ref: usize,
): bool {
  while (entry < current) {
    if (
      (load<usize>(
        entry,
        offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
      ) &
        1) ==
        0 &&
      changetype<usize>(
        load<valueof<T>>(
          entry,
          offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value"),
        ),
      ) == ref
    )
      return true;
    entry += entrySize;
  }
  return false;
}


@inline
function collectEarlierMapValues<T extends Map<any, any>>(
  entry: usize,
  current: usize,
  entrySize: usize,
  refs: Set<usize>,
): void {
  while (entry < current) {
    if (
      (load<usize>(
        entry,
        offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
      ) &
        1) ==
      0
    ) {
      const ref = changetype<usize>(
        load<valueof<T>>(
          entry,
          offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value"),
        ),
      );
      if (ref != 0) refs.add(ref);
    }
    entry += entrySize;
  }
}


@inline
function skipMapWhitespace(srcStart: usize, srcEnd: usize): usize {
  // Root dynamic maps produced with a two-space JSON.stringify indent repeat
  // LF + two spaces + quote for every key. Validate that fixed shape in two
  // loads, retaining the scalar grammar path for all other whitespace.
  if (
    ASC_FEATURE_SIMD &&
    srcStart + 8 <= srcEnd &&
    load<u16>(srcStart) == 10 &&
    load<u32>(srcStart, 2) == 0x0020_0020 &&
    load<u16>(srcStart, 6) == QUOTE
  )
    return srcStart + 6;
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}

function rawMapKeyEquals(key: string, start: usize, end: usize): bool {
  const byteLength = end - start;
  if (<usize>(key.length << 1) != byteLength) return false;
  const keyStart = changetype<usize>(key);
  let offset: usize = 0;
  while (offset + 8 <= byteLength) {
    const block = load<u64>(start + offset);
    if (load<u64>(keyStart + offset) != block) return false;
    // Compare decoded keys only against unescaped source spellings.
    const slash = block ^ 0x005c_005c_005c_005c;
    if ((slash - 0x0001_0001_0001_0001) & ~slash & 0x8000_8000_8000_8000)
      return false;
    offset += 8;
  }
  while (offset < byteLength) {
    const code = load<u16>(start + offset);
    if (code == BACK_SLASH || load<u16>(keyStart + offset) != code)
      return false;
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
    if (!seenKeys.has(key)) changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeDelete(key);
  }
}

export function deserializeMap<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  const reuseExisting = dst != 0 || changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeSize() != 0;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart - srcEnd == 0) return changetype<T>(0);
  if (load<u16>(srcStart) != BRACE_LEFT) return changetype<T>(0);
  if (load<u16>(srcEnd - 2) != BRACE_RIGHT) return changetype<T>(0);

  return deserializeMapBody<T>(
    srcStart,
    srcEnd,
    changetype<T>(out),
    reuseExisting,
  ) == srcEnd
    ? changetype<T>(out)
    : changetype<T>(0);
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
  const pretty = ASC_FEATURE_SIMD && isPrettyParse();
  let arbitraryValue = false;
  let rawValue = false;
  if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    // @ts-ignore: instanceof on the (reference) value type
    arbitraryValue = changetype<nonnull<valueof<T>>>(0) instanceof JSON.Value;
    // @ts-ignore: instanceof on the (reference) value type
    const valueType = changetype<nonnull<valueof<T>>>(0);
    rawValue =
      valueType instanceof JSON.Raw &&
      idof<nonnull<valueof<T>>>() == idof<JSON.Raw>() &&
      !isDefined(valueType.__DESERIALIZE_CUSTOM) &&
      !isDefined(valueType.__DESERIALIZE_SLOW);
  }

  let previousKeys = changetype<Array<indexof<T>>>(0);
  const previousEntries = reuseExisting
    ? load<ArrayBuffer>(
        changetype<usize>(out),
        offsetof<Map<indexof<T>, valueof<T>>>("entries"),
      )
    : changetype<ArrayBuffer>(0);
  const previousEntrySize = reusableMapEntrySize<indexof<T>, valueof<T>>();
  const previousEntryStart = changetype<usize>(previousEntries);
  let previousEntry = previousEntryStart;
  const previousEntryEnd = reuseExisting
    ? previousEntry +
      <usize>(
        load<i32>(
          changetype<usize>(out),
          offsetof<Map<indexof<T>, valueof<T>>>("entriesOffset"),
        )
      ) *
        previousEntrySize
    : 0;
  const previousCount = reuseExisting ? changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeSize() : 0;
  while (
    previousEntry < previousEntryEnd &&
    (load<usize>(
      previousEntry,
      offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
    ) &
      1) !=
      0
  )
    previousEntry += previousEntrySize;
  let seenKeys = changetype<Set<indexof<T>>>(0);
  // Small stable-order maps avoid allocating by scanning prior slots. Larger
  // maps track identities incrementally so alias protection stays linear.
  // A key-order divergence also materializes the set for a small map because
  // the previous-entry cursor can no longer represent the parsed prefix.
  // Allocate the large-map identity set lazily: scalar and other non-reused
  // value types cannot alias and should not pay for reference tracking.
  let reusedValues = changetype<Set<usize>>(0);
  let parsedKeyCount = 0;

  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACE_LEFT) return 0;
  srcStart += 2;
  if (srcStart < srcEnd && load<u16>(srcStart) != QUOTE)
    srcStart = skipMapWhitespace(srcStart, srcEnd);
  if (srcStart >= srcEnd) return 0;
  if (load<u16>(srcStart) == BRACE_RIGHT) {
    if (reuseExisting) changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeClear();
    return srcStart + 2;
  }

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) != QUOTE) break;

    const keyStart = srcStart + 2;
    const keyValueEnd = JSON.Util.scanValueEnd<string>(srcStart, srcEnd);
    if (!keyValueEnd) break;
    const keyEnd = keyValueEnd - 2;

    srcStart = keyEnd + 2;
    if (srcStart < srcEnd && load<u16>(srcStart) != COLON)
      srcStart = skipMapWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd || load<u16>(srcStart) != COLON) break;
    srcStart += 2;
    if (srcStart < srcEnd && isSpace(load<u16>(srcStart)))
      srcStart = skipMapWhitespace(srcStart, srcEnd);

    let reusableKey = "";
    const canReuseKey =
      isString<indexof<T>>() &&
      reuseExisting &&
      previousEntry < previousEntryEnd;
    if (canReuseKey) {
      reusableKey = changetype<string>(
        load<indexof<T>>(
          previousEntry,
          offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("key"),
        ),
      );
    }
    let packedKey: u64 = 0;
    let key: indexof<T>;
    if (isString<indexof<T>>() && !reuseExisting) {
      packedKey = deserializeFreshStringMapKey(keyStart, keyEnd);
      if (packedKey != 0) {
        key = changetype<indexof<T>>(<usize>packedKey);
      } else {
        key = deserializeMapKey<indexof<T>>(keyStart, keyEnd);
      }
    } else {
      key = deserializeMapKey<indexof<T>>(
        keyStart,
        keyEnd,
        reusableKey,
        canReuseKey,
      );
    }
    const matchedPreviousKey =
      reuseExisting &&
      previousEntry < previousEntryEnd &&
      key ==
        load<indexof<T>>(
          previousEntry,
          offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("key"),
        );
    if (reuseExisting) {
      if (changetype<usize>(seenKeys) == 0 && !matchedPreviousKey) {
        previousKeys = changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeKeys();
        seenKeys = new Set<indexof<T>>();
        for (let i = 0; i < parsedKeyCount; i++) {
          seenKeys.add(unchecked(previousKeys[i]));
        }
      }
      if (changetype<usize>(seenKeys) != 0) seenKeys.add(key);
      parsedKeyCount++;
    }

    if (
      isNullable<valueof<T>>() &&
      srcStart + 8 <= srcEnd &&
      load<u64>(srcStart) == NULL_WORD_U64
    ) {
      setParsedMapValue<T>(out, key, changetype<valueof<T>>(0), packedKey);
      srcStart += 8;
    } else if (isReference<valueof<T>>() && arbitraryValue) {
      const val = parseValue(srcStart, srcEnd);
      const next = lastValueEnd();
      if (!next) break;
      // @ts-ignore: type - valueof<T> is JSON.Value in this branch
      setParsedMapValue<T>(
        out,
        key,
        changetype<valueof<T>>(changetype<usize>(val)),
        packedKey,
      );
      srcStart = next;
    } else if (isReference<valueof<T>>() && rawValue) {
      const valueEnd = scanValueEnd(srcStart, srcEnd);
      if (!valueEnd || valueEnd <= srcStart) break;
      let raw: JSON.Raw | null = null;
      if (reuseExisting && changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeHas(key)) {
        raw = changetype<JSON.Raw>(
          changetype<usize>(changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeGet(key)),
        );
      }
      if (raw !== null) {
        const slot = matchedPreviousKey
          ? previousEntry +
            offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value")
          : reusableMapValueSlot<T>(out, key);
        raw = changetype<JSON.Raw | null>(
          reuseComposite(changetype<usize>(raw), slot),
        );
      }
      if (raw !== null) {
        if (
          !changetype<usize>(reusedValues) &&
          previousCount > ALIAS_SCAN_LIMIT
        )
          reusedValues = new Set<usize>();
        const ref = changetype<usize>(raw);
        if (matchedPreviousKey) {
          if (changetype<usize>(reusedValues)) {
            if (reusedValues.has(ref)) raw = null;
            else reusedValues.add(ref);
          } else if (
            reusedMapValueEarlier<T>(
              previousEntryStart,
              previousEntry,
              previousEntrySize,
              ref,
            )
          )
            raw = null;
        } else {
          if (!changetype<usize>(reusedValues)) {
            reusedValues = new Set<usize>();
            if (parsedKeyCount > 1)
              collectEarlierMapValues<T>(
                previousEntryStart,
                previousEntry,
                previousEntrySize,
                reusedValues,
              );
          }
          if (reusedValues.has(ref)) raw = null;
          else reusedValues.add(ref);
        }
      }
      const value = deserializeRaw(srcStart, valueEnd, changetype<usize>(raw));
      // @ts-ignore: valueof<T> is JSON.Raw in this branch
      setParsedMapValue<T>(
        out,
        key,
        changetype<valueof<T>>(changetype<usize>(value)),
        packedKey,
      );
      srcStart = valueEnd;
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
        if (matchedPreviousKey) {
          value = load<valueof<T>>(
            previousEntry,
            offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value"),
          );
        } else if (reuseExisting && changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeHas(key)) {
          value = changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeGet(key);
        }
        // A stable map-entry value slot identifies the logical destination,
        // including repeated keys, across the complete public parse.
        if (changetype<usize>(value) != 0) {
          const slot = matchedPreviousKey
            ? previousEntry +
              offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("value")
            : reusableMapValueSlot<T>(out, key);
          value = changetype<valueof<T>>(
            reuseComposite(changetype<usize>(value), slot),
          );
        }
        // A destination graph may share one instance across different keys.
        // Only its first occurrence can be mutated without changing an earlier
        // result. Allocate replacements for subsequent occurrences.
        if (changetype<usize>(value) != 0) {
          if (
            !changetype<usize>(reusedValues) &&
            previousCount > ALIAS_SCAN_LIMIT
          )
            reusedValues = new Set<usize>();
          const ref = changetype<usize>(value);
          if (matchedPreviousKey) {
            if (changetype<usize>(reusedValues)) {
              if (reusedValues.has(ref)) value = changetype<valueof<T>>(0);
              else reusedValues.add(ref);
            } else if (
              reusedMapValueEarlier<T>(
                previousEntryStart,
                previousEntry,
                previousEntrySize,
                ref,
              )
            )
              value = changetype<valueof<T>>(0);
          } else {
            if (!changetype<usize>(reusedValues)) {
              reusedValues = new Set<usize>();
              if (parsedKeyCount > 1)
                collectEarlierMapValues<T>(
                  previousEntryStart,
                  previousEntry,
                  previousEntrySize,
                  reusedValues,
                );
            }
            if (reusedValues.has(ref)) value = changetype<valueof<T>>(0);
            else reusedValues.add(ref);
          }
        }
        const reusedMappedValue =
          matchedPreviousKey && changetype<usize>(value) != 0;
        let initialized = false;
        if (changetype<usize>(value) == 0) {
          value = changetype<valueof<T>>(
            __new(offsetof<nonnull<valueof<T>>>(), idof<nonnull<valueof<T>>>()),
          );
          // @ts-ignore: supplied by the json-as transform
          if (isDefined(valueType.__INITIALIZE)) {
            // @ts-ignore: supplied by the json-as transform
            changetype<nonnull<valueof<T>>>(value).__INITIALIZE();
            initialized = true;
          }
        }

        const valueStart = srcStart;
        let canFast = isDefined(valueType.__DESERIALIZE_FAST);
        if (isDefined(valueType.__DESERIALIZE_FAST_ENABLED))
          canFast =
            changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST_ENABLED();
        let attemptedFast = false;
        let next: usize = 0;
        // @ts-ignore: supplied by the json-as transform
        if (isDefined(valueType.__DESERIALIZE_FAST) && canFast) {
          attemptedFast = true;
          // @ts-ignore: supplied by the json-as transform
          if (pretty && isDefined(valueType.__DESERIALIZE_FAST_PRETTY)) {
            // @ts-ignore: supplied by the json-as transform
            next = changetype<nonnull<valueof<T>>>(
              value,
            ).__DESERIALIZE_FAST_PRETTY(srcStart, srcEnd, value, !initialized);
          } else {
            // @ts-ignore: supplied by the json-as transform
            next = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST(
              srcStart,
              srcEnd,
              value,
              !initialized,
            );
          }
        }
        if (!next) {
          const valueEnd = scanValueEnd(valueStart, srcEnd);
          if (!valueEnd || valueEnd <= valueStart) break;
          // A failed FAST attempt may have partially overwritten fields.
          // @ts-ignore: supplied by the json-as transform
          if (
            (!initialized || attemptedFast) &&
            isDefined(valueType.__INITIALIZE)
          ) {
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

        // Stable-order re-parses mutate the same mapped object in place. Avoid
        // hashing the key and re-linking the identical reference on every
        // entry; shape/order changes still take the ordinary Map path.
        if (!reusedMappedValue)
          setParsedMapValue<T>(out, key, value, packedKey);
        srcStart = next;
      } else {
        const valueEnd = scanValueEnd(srcStart, srcEnd);
        if (!valueEnd || valueEnd <= srcStart) break;
        // @ts-ignore: type
        setParsedMapValue<T>(
          out,
          key,
          JSON.__deserialize<valueof<T>>(srcStart, valueEnd),
          packedKey,
        );
        srcStart = valueEnd;
      }
    } else {
      const valueEnd = scanValueEnd(srcStart, srcEnd);
      if (!valueEnd || valueEnd <= srcStart) break;
      // @ts-ignore: type
      setParsedMapValue<T>(
        out,
        key,
        JSON.__deserialize<valueof<T>>(srcStart, valueEnd),
        packedKey,
      );
      srcStart = valueEnd;
    }

    if (matchedPreviousKey) {
      previousEntry += previousEntrySize;
      while (
        previousEntry < previousEntryEnd &&
        (load<usize>(
          previousEntry,
          offsetof<ReusableMapEntry<indexof<T>, valueof<T>>>("taggedNext"),
        ) &
          1) !=
          0
      )
        previousEntry += previousEntrySize;
    } else {
      // Once insertion order diverges, ordinary Map lookup is the safe path
      // for all remaining values. `seenKeys` tracks stale-key cleanup.
      previousEntry = previousEntryEnd;
    }

    if (srcStart >= srcEnd) break;
    let code = load<u16>(srcStart);
    if (code != COMMA && code != BRACE_RIGHT) {
      srcStart = skipMapWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;
      code = load<u16>(srcStart);
    }
    if (code == COMMA) {
      srcStart += 2;
      if (srcStart < srcEnd && load<u16>(srcStart) != QUOTE)
        srcStart = skipMapWhitespace(srcStart, srcEnd);
      continue;
    }
    if (code == BRACE_RIGHT) {
      if (
        reuseExisting &&
        changetype<usize>(previousKeys) == 0 &&
        parsedKeyCount != previousCount
      )
        previousKeys = changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeKeys();
      removeStaleMapKeys<T>(out, previousKeys, seenKeys, parsedKeyCount);
      return srcStart + 2;
    }
    break;
  }

  return 0;
}

export function deserializeMapField<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  let out = changetype<T>(reuseComposite(load<usize>(fieldPtr), fieldPtr));
  const reuseExisting = changetype<usize>(out) != 0;
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  }
  return deserializeMapBody<T>(
    srcStart,
    srcEnd,
    out,
    reuseExisting || changetype<NativeMap<indexof<T>, valueof<T>>>(out).nativeSize() != 0,
  );
}
