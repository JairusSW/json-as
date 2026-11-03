import { JSON } from "..";


@json class StaticStringsOwner {
  items: StaticArray<string> = [];
}


@json class NullableStaticStringsOwner {
  items: StaticArray<string | null> = [];
}
const out = new StaticStringsOwner();
const nullableOut = new NullableStaticStringsOwner();
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function run(source: string, kind: i32): string {
  if (kind == 0) return JSON.stringify(JSON.parse<StaticArray<string>>(source));
  if (kind == 1) return JSON.stringify(JSON.parse<StaticStringsOwner>(source));
  if (kind == 2)
    return JSON.stringify(JSON.parse<StaticStringsOwner>(source, out));
  if (kind == 3)
    return JSON.stringify(JSON.parse<StaticArray<string | null>>(source));
  if (kind == 4)
    return JSON.stringify(JSON.parse<NullableStaticStringsOwner>(source));
  return JSON.stringify(
    JSON.parse<NullableStaticStringsOwner>(source, nullableOut),
  );
}
