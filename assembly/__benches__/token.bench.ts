import { JSON } from "../";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";


@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
}
const v1 = new Token();
const v2 = JSON.stringify(v1);
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Token>(v2))).toBe(v2);
bench(
  "Serialize Token Object",
  () => {
    blackbox<string>(inline.always(JSON.stringify(v1)));
  },
  10_000_000,
  v2.length,
);
dumpToFile("token", "serialize");
bench(
  "Deserialize Token Object",
  () => {
    blackbox<Token>(inline.always(JSON.parse<Token>(v2)));
  },
  10_000_000,
  v2.length,
);
dumpToFile("token", "deserialize");
