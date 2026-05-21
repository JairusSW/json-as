import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1: string = "hello world";
const v2 = '"hello world"';

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<string>(v2))).toBe(v2);

bench(
  "Serialize string",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-string", "serialize");

bench(
  "Deserialize string",
  () => {
    blackbox(inline.always(JSON.parse<string>(v2)));
  },
  20_000_000,
  v2.length,
);
dumpToFile("prim-string", "deserialize");
