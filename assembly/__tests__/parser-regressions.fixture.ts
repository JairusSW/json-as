import { JSON } from "..";


@json
class Item {
  n: i32 = 0;
}


@json
class Items {
  items: Item[] = [];
}


@json
class Collections {
  dates: StaticArray<Date | null> = [];
  sets: StaticArray<Set<i32> | null> = [];
  arrays: (StaticArray<i32> | null)[] = [];
  dynamic: (JSON.Arr | null)[] = [];
}


@json
class LazyItem {

  @lazy text: string = "";
}


@json
class LazyHolder {
  item: LazyItem = new LazyItem();
}


@json
class Deferred {

  @lazy item: LazyItem = new LazyItem();


  @lazy items: LazyItem[] = [];


  @lazy values: Map<string, LazyItem> = new Map<string, LazyItem>();


  @lazy dynamic: JSON.Obj = new JSON.Obj();
}


@json
class LazyInteger {

  @lazy n: i32 = 0;
}

export function allocInput(size: i32): usize {
  return __new(size, idof<string>());
}

export function directInt(s: string): i32 {
  return JSON.parse<i32>(s);
}
export function directUnsigned(s: string): u32 {
  return JSON.parse<u32>(s);
}
export function narrowInt(s: string): i8 {
  return JSON.parse<i8>(s);
}
export function fieldInt(s: string): i32 {
  return JSON.parse<Item>(s).n;
}
export function lazyInt(s: string): i32 {
  return JSON.parse<LazyInteger>(s).n;
}
export function setBool(s: string): string {
  return JSON.stringify(JSON.parse<Set<bool>>(s));
}
export function setInt(s: string): string {
  return JSON.stringify(JSON.parse<Set<i32>>(s));
}
export function setUnsigned(s: string): string {
  return JSON.stringify(JSON.parse<Set<u32>>(s));
}
export function mapInt(s: string): string {
  return JSON.stringify(JSON.parse<Map<string, i32>>(s));
}
export function arrayDate(s: string): string {
  return JSON.stringify(JSON.parse<Date[]>(s));
}
export function arrayNested(s: string): string {
  return JSON.stringify(JSON.parse<i32[][]>(s));
}
export function staticDate(s: string): string {
  return JSON.stringify(JSON.parse<StaticArray<Date | null>>(s));
}
export function staticSet(s: string): string {
  return JSON.stringify(JSON.parse<StaticArray<Set<i32> | null>>(s));
}
export function staticArr(s: string): string {
  return JSON.stringify(JSON.parse<StaticArray<JSON.Arr | null>>(s));
}
export function arrayStatic(s: string): string {
  return JSON.stringify(JSON.parse<(StaticArray<i32> | null)[]>(s));
}
export function arrayArr(s: string): string {
  return JSON.stringify(JSON.parse<(JSON.Arr | null)[]>(s));
}
export function fieldCollections(s: string): string {
  const out = JSON.parse<Collections>(s);
  return JSON.stringify(JSON.parse<Collections>(s, out));
}
export function reuseStaticDate(s: string): string {
  const out: StaticArray<Date | null> = [new Date(0), null, new Date(1)];
  return JSON.stringify(JSON.parse<StaticArray<Date | null>>(s, out));
}
export function reuseArrayStatic(s: string): string {
  const inner: StaticArray<i32> = [99];
  const out: (StaticArray<i32> | null)[] = [inner, null, inner];
  return JSON.stringify(JSON.parse<(StaticArray<i32> | null)[]>(s, out));
}
export function reusedEscapedMap(s: string, key: string): string {
  const out = new Map<string, i32>();
  out.set(key, 99);
  return JSON.stringify(JSON.parse<Map<string, i32>>(s, out));
}
export function sharedMap(s: string): string {
  const out = new Map<string, Item>();
  const item = new Item();
  out.set("a", item);
  out.set("b", item);
  out.set("c", item);
  return JSON.stringify(JSON.parse<Map<string, Item>>(s, out));
}
export function sharedRawMap(s: string): string {
  const out = new Map<string, JSON.Raw>();
  const raw = new JSON.Raw("0");
  out.set("a", raw);
  out.set("b", raw);
  return JSON.stringify(JSON.parse<Map<string, JSON.Raw>>(s, out));
}
export function sharedArray(s: string): string {
  const item = new Item();
  const out = [item, item, item];
  return JSON.stringify(JSON.parse<Item[]>(s, out));
}
export function sharedArrayField(s: string): string {
  const out = new Items();
  const item = new Item();
  out.items = [item, item, item];
  return JSON.stringify(JSON.parse<Items>(s, out));
}
export function sharedNullableArray(s: string): string {
  const item = new Item();
  const out: (Item | null)[] = [item, null, item];
  return JSON.stringify(JSON.parse<(Item | null)[]>(s, out));
}
export function uniqueArrayIdentity(s: string): bool {
  const a = new Item(),
    b = new Item();
  const out = [a, b];
  return JSON.parse<Item[]>(s, out) === out && out[0] === a && out[1] === b;
}
export function uniqueMapIdentity(s: string): bool {
  const a = new Item(),
    b = new Item();
  const out = new Map<string, Item>();
  out.set("a", a);
  out.set("b", b);
  return (
    JSON.parse<Map<string, Item>>(s, out) === out &&
    out.get("a") === a &&
    out.get("b") === b
  );
}
export function nullableRawMap(s: string): bool {
  const out = new Map<string, JSON.Raw | null>();
  out.set("x", new JSON.Raw("7"));
  const parsed = JSON.parse<Map<string, JSON.Raw | null>>(s, out);
  return parsed === out && parsed.get("x") === null;
}
export function nullableRawTransitions(s: string): string {
  const out = JSON.parse<Map<string, JSON.Raw | null>>('{"x":null}');
  return JSON.stringify(JSON.parse<Map<string, JSON.Raw | null>>(s, out));
}
export function nonnullRawMap(s: string): bool {
  return changetype<usize>(JSON.parse<Map<string, JSON.Raw>>(s).get("x")) != 0;
}

let saved: LazyItem | null = null;
let deferred: Deferred | null = null;
let dynamic: JSON.Obj | null = null;
export function saveLazy(s: string, kind: i32): void {
  if (kind == 0) saved = JSON.parse<LazyItem>(s);
  else if (kind == 1) saved = JSON.parse<Map<string, LazyItem>>(s).get("x");
  else if (kind == 2) saved = JSON.parse<LazyItem[]>(s)[0];
  else if (kind == 3) saved = JSON.parse<LazyHolder>(s).item;
  else deferred = JSON.parse<Deferred>(s);
}
export function materializeLazy(kind: i32): void {
  if (kind == 4) saved = deferred!.item;
  else if (kind == 5) saved = deferred!.items[0];
  else if (kind == 6) saved = deferred!.values.get("x");
  else if (kind == 7) dynamic = deferred!.dynamic.getAs<JSON.Obj>("child");
  deferred = null;
}
export function readLazy(kind: i32): string {
  return kind == 7 ? dynamic!.getAs<string>("text") : saved!.text;
}
