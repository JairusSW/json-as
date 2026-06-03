import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench.js";
import parseFast from "fast-json-parse";
import { JS_FAST_PARSE_OPS, MULTILIB_PAYLOAD_FILE } from "./shared.js";

const payload = readFile(MULTILIB_PAYLOAD_FILE);

bench(
  "Deserialize Multilib Payload (fast-json-parse)",
  () => {
    blackbox(parseFast(payload));
  },
  JS_FAST_PARSE_OPS,
  utf8ByteLength(payload),
);
dumpToFile("multilib-fast-json-parse", "deserialize");
