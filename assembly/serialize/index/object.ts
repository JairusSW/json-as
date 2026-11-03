import { keyLength, KEY_HEADER_UNITS } from "../../util/key-buffer";
import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";
import { serializeArbitrary } from "./arbitrary";
import { serializePrimitiveSlot } from "./primitive";
import { serializeString } from "./string";
import { serializeStringRange } from "../naive/string";

// Inspect only concrete dynamic containers. Deferred JSON and ordinary
// primitive/reference leaves cannot execute callbacks. Bound recursion so
// cyclic/deep graphs conservatively use the mutation-safe path.
function mayInvokeCallback(slot: u64, depth: i32 = 0): bool {
  const tag = JSON.Value.slotTag(slot);
  if (tag == JSON.Types.Struct || tag == JSON.Types.Map)
    return !JSON.Value.slotHasPureSerializer(slot);
  if (tag == JSON.Types.Object) {
    if (depth >= 16) return true;
    const value = JSON.Value.decodeBits<JSON.Obj>(slot);
    if (value._rawStart) return false;
    for (let i = 0; i < value.size; i++)
      if (mayInvokeCallback(unchecked(value._vals[i]), depth + 1)) return true;
  } else if (tag == JSON.Types.Array) {
    if (depth >= 16) return true;
    const value = JSON.Value.decodeBits<JSON.Arr>(slot);
    for (let i = 0; i < value.length; i++)
      if (mayInvokeCallback(unchecked(value._vals[i]), depth + 1)) return true;
  }
  return false;
}

function emitSlot(src: JSON.Obj, slot: u64): void {
  if (JSON.Value.slotIsLazy(slot)) {
    const source = src._src;
    const base = changetype<usize>(source);
    const start = JSON.Value.slotPtr(slot, base);
    const end = JSON.Value.slotEnd(
      slot,
      base,
      base + ((<usize>source.length) << 1),
    );
    bs.proposeSize(<u32>(end - start));
    memory.copy(bs.offset, start, end - start);
    bs.offset += end - start;
  } else if (!serializePrimitiveSlot(slot)) {
    const value = JSON.Value.fromBits(slot);
    serializeArbitrary(value);
  }
}

function serializeCallbackObject(src: JSON.Obj): void {
  const keys = src.keys();
  const n = keys.length;
  const identities = new Map<string, i32>();
  const ids = new StaticArray<i32>(n);
  const ordinals = new StaticArray<u32>(n);
  const counts = new StaticArray<u32>(n);
  for (let i = 0; i < n; i++) {
    const key = unchecked(keys[i]);
    let id: i32;
    if (identities.has(key)) id = identities.get(key);
    else {
      id = i;
      identities.set(key, id);
    }
    unchecked((ids[i] = id));
    unchecked((ordinals[i] = counts[id]++));
  }
  let version = src._structureVersion;
  let indices = changetype<Map<u64, i32>>(0);
  bs.proposeSize(4 + <u32>n * 4);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;
  let wrote = false;
  for (let i = 0; i < n; i++) {
    if (version != src._structureVersion) {
      // Rebuild once per structural change, not once per visited property.
      // Dense key IDs and occurrence ordinals retain duplicate identities.
      const current = src.keys();
      indices = new Map<u64, i32>();
      counts.fill(0);
      for (let j = 0; j < current.length; j++) {
        const key = unchecked(current[j]);
        if (!identities.has(key)) continue;
        const id = identities.get(key);
        const ordinal = unchecked(counts[id]++);
        indices.set(((<u64>(<u32>id)) << 32) | ordinal, j);
      }
      version = src._structureVersion;
    }
    let index = i;
    if (changetype<usize>(indices)) {
      const identity =
        ((<u64>(<u32>unchecked(ids[i]))) << 32) | unchecked(ordinals[i]);
      if (!indices.has(identity)) continue;
      index = indices.get(identity);
    }
    const slot = unchecked(src._vals[index]);
    if (wrote) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    serializeString(unchecked(keys[i]));
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    emitSlot(src, slot);
    wrote = true;
  }
  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}

export function serializeObject(src: JSON.Obj): void {
  const rawStart = src._rawStart;
  if (rawStart != 0) {
    const rawSize = src._rawEnd - rawStart;
    // At top level, `bs.out` can copy the anchored source slice straight into
    // the returned string. Nested objects already have parent bytes in the
    // staging buffer and therefore keep the regular append path below.
    if (bs.offset == bs.buffer && bs.cacheOutput == 0) {
      bs.cacheOutput = rawStart;
      bs.cacheOutputLen = rawSize;
      return;
    }
    bs.proposeSize(u32(rawSize));
    memory.copy(bs.offset, rawStart, rawSize);
    bs.offset += rawSize;
    return;
  }

  const srcSize = src.size;

  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 8192123);
    bs.offset += 4;
    return;
  }

  for (let i = 0; i < srcSize; i++) {
    const slot = unchecked(src._vals[i]);
    const tag = JSON.Value.slotTag(slot);
    if (
      <u32>(tag - JSON.Types.Object) <= JSON.Types.Struct - JSON.Types.Object &&
      mayInvokeCallback(slot)
    ) {
      serializeCallbackObject(src);
      return;
    }
  }
  const vals = src._vals;
  const kbuf = changetype<usize>(src._kbuf);
  const kused = src._kused;
  // Source base + upper bound for resolving a deferred slot's value range.
  const srcBase = changetype<usize>(src._src);
  const srcEnd = srcBase + ((<usize>src._src.length) << 1);

  bs.proposeSize(4 + <u32>(srcSize - 1) * 2 + <u32>srcSize * 2);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  // Walk the length-prefixed key buffer in lockstep with the value slots,
  // emitting each key straight from its slice (no per-key string
  // materialization). A still-deferred slot is copied out verbatim from the
  // source; an eager/materialized slot is serialized from its boxed bits.
  let pos = 0;
  let i = 0;
  while (pos < kused) {
    const len = keyLength(kbuf + ((<usize>pos) << 1));
    const header = KEY_HEADER_UNITS;
    if (i != 0) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    serializeStringRange(
      kbuf + ((<usize>(pos + header)) << 1),
      (<usize>len) << 1,
    );
    store<u16>(bs.offset, COLON);
    bs.offset += 2;

    const slot = unchecked(vals[i]);
    if (JSON.Value.slotIsLazy(slot)) {
      const start = JSON.Value.slotPtr(slot, srcBase);
      const end = JSON.Value.slotEnd(slot, srcBase, srcEnd);
      const size = end - start;
      bs.proposeSize(u32(size));
      memory.copy(bs.offset, start, size);
      bs.offset += size;
    } else if (!serializePrimitiveSlot(slot)) {
      const v = JSON.Value.fromBits(slot);
      serializeArbitrary(v);
    }
    pos += header + len;
    i++;
  }

  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
