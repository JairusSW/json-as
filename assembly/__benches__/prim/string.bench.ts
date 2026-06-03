import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

const v1: string = "hello world";
const v2 = '"hello world"';

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<string>(v2))).toBe(v2);

bench(
  "Serialize string",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-string", "serialize");

bench(
  "Deserialize string",
  () => {
    blackbox(JSON.parse<string>(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-string", "deserialize");
