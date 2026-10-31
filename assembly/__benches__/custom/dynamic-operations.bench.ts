import { JSON } from "../..";
import { bench, blackbox } from "../lib/bench";

const keys: string[] = [];
const map = new Map<string, i32>();
let source = "{";
for (let i = 0; i < 128; i++) {
  const key = "key" + i.toString();
  keys.push(key);
  map.set(key, i);
  if (i) source += ",";
  source += '"' + key + '":' + i.toString();
}
source += "}";
const deletion = JSON.parse<JSON.Obj>(source);
const serializable = JSON.parse<JSON.Obj>(source);
serializable.set("key64", 64);
const readable = JSON.parse<JSON.Obj>(source);
const left = JSON.parse<JSON.Arr>('[{"n":1},[2],"text",true,null,42]');
const right = left.slice();
const fillTarget = new JSON.Arr();
fillTarget.length = 4096;
const fillValue = JSON.Raw.from('{"n":1}');

function deleteRestore(): void {
  deletion.delete("key64");
  deletion.set("key64", 64);
  blackbox(deletion.size);
}
function concat(): void {
  blackbox(left.concat(right));
}
function fromMap(): void {
  blackbox(JSON.Obj.from(map));
}
function fill(): void {
  blackbox(fillTarget.fill(fillValue));
}
bench("Obj delete + restore (128 keys)", deleteRestore, 100_000);
bench("Arr concat (shared lazy source)", concat, 200_000);
bench("Obj from Map (128 keys)", fromMap, 20_000);
bench("Arr fill (4096 managed slots)", fill, 20_000);

function parseObject(): void {
  blackbox(JSON.parse<JSON.Obj>(source));
}
function stringifyObject(): void {
  blackbox(JSON.stringify(serializable));
}
function lookupObject(): void {
  let sum = 0.0;
  for (let i = 0; i < keys.length; i++)
    sum += readable.getAs<f64>(unchecked(keys[i]));
  blackbox(sum);
}
bench("Obj parse (128 short keys)", parseObject, 100_000);
bench("Obj stringify (128 short keys)", stringifyObject, 100_000);
bench("Obj lookup (128 short keys)", lookupObject, 100_000);
