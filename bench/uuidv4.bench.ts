import { dumpToFile } from "./lib/bench.js";
import { bench, blackbox } from "./lib/bench.js";

const v1 = "75a60587-c4d7-4764-91ac-9fd1d6baf07e";
const v2 = '"75a60587-c4d7-4764-91ac-9fd1d6baf07e"';

bench(
  "Serialize UUIDv4",
  () => {
    blackbox(JSON.stringify(v1));
  },
  25_000_000,
  v1.length << 1,
);
dumpToFile("uuidv4", "serialize");

bench(
  "Deserialize UUIDv4",
  () => {
    blackbox(JSON.parse(v2));
  },
  25_000_000,
  v2.length << 1,
);
dumpToFile("uuidv4", "deserialize");
