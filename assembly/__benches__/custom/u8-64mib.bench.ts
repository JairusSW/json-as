import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

function buildU8Json(targetBytes: i32): string {
  let block = "";
  for (let i = 0; i < 256; i++) {
    block += i.toString();
    block += ",";
  }
  const blockBytes = String.UTF8.byteLength(block);
  const repeats = i32(
    Math.max(1, Math.floor(f64(targetBytes - 2 + 1) / f64(blockBytes))),
  );
  const joined = block.repeat(repeats);
  return "[" + joined.slice(0, joined.length - 1) + "]";
}

const json64mib = buildU8Json(64 * 1024 * 1024);
const bytes64mib = String.UTF8.byteLength(json64mib);

expect(JSON.stringify(JSON.parse<u8[]>(json64mib))).toBe(json64mib);

bench(
  "Deserialize u8[] (64mib)",
  () => {
    blackbox(JSON.parse<u8[]>(json64mib));
  },
  30,
  bytes64mib,
);
dumpToFile("u8-64mib", "deserialize");
