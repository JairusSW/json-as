import { JSON } from "../";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench";
import { nonDefaultValues } from "./lib/nondefault";


@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
}
const v1 = new Token();
const v2 = JSON.stringify(v1);
const nonDefaultJson = nonDefaultValues(v2);
const nonDefaultValue = JSON.parse<Token>(nonDefaultJson);
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Token>(v2))).toBe(v2);
expect(JSON.stringify(nonDefaultValue)).toBe(nonDefaultJson);
bench(
  "Serialize Token Object",
  () => {
    blackbox<string>(JSON.stringify(v1));
  },
  10_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "serialize");
bench(
  "Deserialize Token Object",
  () => {
    blackbox<Token>(JSON.parse<Token>(v2));
  },
  10_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "deserialize");

bench(
  "Serialize Token Object (non-default)",
  () => {
    blackbox<string>(JSON.stringify(nonDefaultValue));
  },
  10_000_000,
  utf8ByteLength(nonDefaultJson),
);
dumpToFile("token-nondefault", "serialize");
bench(
  "Deserialize Token Object (non-default)",
  () => {
    blackbox<Token>(JSON.parse<Token>(nonDefaultJson));
  },
  10_000_000,
  utf8ByteLength(nonDefaultJson),
);
dumpToFile("token-nondefault", "deserialize");

// Dynamic JSON.Obj variant of the same payload (typed struct vs JSON.Obj).
const objToken = JSON.parse<JSON.Obj>(v2);
bench(
  "Serialize Token (JSON.Obj)",
  () => {
    blackbox(JSON.stringify(objToken));
  },
  10_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token-obj", "serialize");
bench(
  "Deserialize Token (JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(v2));
  },
  10_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token-obj", "deserialize");
