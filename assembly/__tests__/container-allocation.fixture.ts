import { JSON } from "..";
let strings: JSON.Arr = new JSON.Arr();
let set = new Set<i32>();
let output = "";
let setSource = "";
let valueSource = "";
let keysSource = "";
let object = new JSON.Obj();
export function setup(): void {
  for (let i = 0; i < 1000; i++) {
    strings.push<string>("x");
    set.add(i);
  }
  output = JSON.stringify(set);
  setSource = output;
  valueSource = '{"data":"' + "x".repeat(20_000) + '"}';
  keysSource = "{";
  for (let i = 0; i < 1000; i++) {
    if (i) keysSource += ",";
    keysSource += '"key' + i.toString() + '":' + i.toString();
  }
  keysSource += "}";
}
export function serializeStrings(): i32 {
  output = JSON.stringify(strings);
  return output.length;
}
export function serializeSet(): i32 {
  output = JSON.stringify(set, output);
  return output.length;
}
export function parseSet(reuse: bool): i32 {
  set = JSON.parse<Set<i32>>(setSource, reuse ? set : changetype<Set<i32>>(0));
  return set.size;
}
export function parseObject(dense: bool): i32 {
  object = JSON.parse<JSON.Obj>(dense ? keysSource : valueSource);
  return object.size;
}
export function metadataBytes(): i32 {
  return (
    (object._kbuf.length << 1) +
    (object._kpos.length << 2) +
    (object._vals.length << 3)
  );
}
export function retainedArray(): i32 {
  const value = JSON.parse<JSON.Arr>('[1,"' + "x".repeat(100_000) + '"]');
  value.length = 0;
  return value._src.length;
}
export function retainedObject(): i32 {
  const value = JSON.parse<JSON.Obj>(
    '{"small":1,"large":"' + "x".repeat(100_000) + '"}',
  );
  value.delete("large");
  return value._src.length;
}


@json class TraceRecord {
  value: string = "";
}
let traced: TraceRecord | null = null;
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function trace(source: string): void {
  traced = JSON.parse<TraceRecord>(source);
  JSON.parse<TraceRecord>(source, traced!);
  JSON.parse<TraceRecord>(source, traced!);
}
export function dropTraceOutput(): void {
  traced = null;
}
export function freshParse(): void {
  JSON.parse<TraceRecord>('{"value":"fresh"}');
}
export function shrink(): void {
  JSON.Memory.shrink();
}
