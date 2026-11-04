import { NativeMap } from "../../util/native-collections";
import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";
import { serializeString } from "../index/string";
import { serializeRaw } from "./raw";


@unmanaged class SerializableMapEntry<K, V> {
  key: K;
  value: V;
  taggedNext: usize;
}


@inline function mapEntrySize<K, V>(): usize {
  const maxKV = sizeof<K>() > sizeof<V>() ? sizeof<K>() : sizeof<V>();
  const align = (maxKV > sizeof<usize>() ? maxKV : sizeof<usize>()) - 1;
  return (offsetof<SerializableMapEntry<K, V>>() + align) & ~align;
}


@inline function serializeMapValue<V>(value: V, rawValue: usize): void {
  if (isReference<V>() && !isNullable<V>()) {
    const valueType = changetype<nonnull<V>>(0);
    // @ts-ignore: instanceof on the reference value type
    if (
      valueType instanceof JSON.Raw &&
      !isDefined(valueType.__SERIALIZE) &&
      !isDefined(valueType.__SERIALIZE_CUSTOM)
    ) {
      serializeRaw(changetype<JSON.Raw>(rawValue));
      return;
    }
  }
  JSON.__serialize<V>(value);
}

@inline
function serializeMapKey<K>(key: K): void {
  if (isString<K>()) {
    if (isNullable<K>() && changetype<usize>(key) == 0) serializeString("null");
    else serializeString(changetype<string>(key));
  } else JSON.__serialize<string>(JSON.internal.stringify<K>(key));
}

// Snapshot original keys, read each value when visited, skip deleted keys,
// and defer additions until a later call. Rehash cannot move this iteration.
function serializeCallbackMap<T extends Map<any, any>>(src: T): void {
  const keys = changetype<NativeMap<indexof<T>, valueof<T>>>(src).nativeKeys();
  bs.proposeSize(4 + <u32>keys.length * 4);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;
  let wrote = false;
  for (let i = 0; i < keys.length; i++) {
    const key = unchecked(keys[i]);
    if (!changetype<NativeMap<indexof<T>, valueof<T>>>(src).nativeHas(key)) continue;
    const value = changetype<NativeMap<indexof<T>, valueof<T>>>(src).nativeGet(key);
    if (wrote) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    serializeMapKey<indexof<T>>(key);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    JSON.__serialize<valueof<T>>(value);
    wrote = true;
  }
  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}

export function serializeMap<T extends Map<any, any>>(src: T): void {
  const srcSize = changetype<NativeMap<indexof<T>, valueof<T>>>(src).nativeSize();

  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 8192123);
    bs.offset += 4;
    return;
  }

  const keyIsString = isString<indexof<T>>();
  if (!keyIsString && isManaged<indexof<T>>()) {
    serializeCallbackMap<T>(src);
    return;
  }
  if (isManaged<valueof<T>>() && !isString<valueof<T>>()) {
    const valueType = changetype<nonnull<valueof<T>>>(0);
    if (
      isDefined(valueType.__SERIALIZE) ||
      isDefined(valueType.__SERIALIZE_CUSTOM) ||
      !(valueType instanceof JSON.Raw)
    ) {
      serializeCallbackMap<T>(src);
      return;
    }
  }

  bs.proposeSize(4 + <u32>(srcSize - 1) * 2 + <u32>srcSize * 2);

  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  const srcPtr = changetype<usize>(src);
  const initialEntriesOffset = load<i32>(srcPtr, offsetof<T>("entriesOffset"));
  const stride = mapEntrySize<indexof<T>, valueof<T>>();
  for (let i = 0; i < initialEntriesOffset; i++) {
    // A custom key/value serializer can re-enter user code and mutate this
    // map. Reload its storage on every iteration so a rehash cannot leave a
    // stale backing pointer live across callbacks.
    if (i >= load<i32>(srcPtr, offsetof<T>("entriesOffset"))) break;
    const entries = load<usize>(srcPtr, offsetof<T>("entries"));
    const entry = changetype<SerializableMapEntry<indexof<T>, valueof<T>>>(
      entries + <usize>i * stride,
    );
    if ((entry.taggedNext & 1) != 0) continue;
    // Root/copy the complete current pair before either serializer can mutate
    // the map. rawValue is used only by the compile-time JSON.Raw branch.
    const key = entry.key;
    const value = entry.value;
    const rawValue = load<usize>(
      changetype<usize>(entry),
      offsetof<SerializableMapEntry<indexof<T>, valueof<T>>>("value"),
    );
    serializeMapKey<indexof<T>>(key);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    serializeMapValue<valueof<T>>(value, rawValue);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }
  store<u16>(bs.offset - 2, BRACE_RIGHT);
}
