import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const v1 = "75a60587-c4d7-4764-91ac-9fd1d6baf07e";
const v2 = '"75a60587-c4d7-4764-91ac-9fd1d6baf07e"';

expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize UUIDv4",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  25_000_000,
  v1.length << 1,
);
dumpToFile("uuidv4", "serialize");

bench(
  "Deserialize UUIDv4",
  () => {
    blackbox(inline.always(JSON.parse<string>(v2)));
  },
  25_000_000,
  v2.length << 1,
);
dumpToFile("uuidv4", "deserialize");
