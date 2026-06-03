import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench.js";
import { JS_NATIVE_PARSE_OPS, MULTILIB_PAYLOAD_FILE } from "./shared.js";

const payload = readFile(MULTILIB_PAYLOAD_FILE);

bench(
  "Deserialize Multilib Payload (native JSON)",
  () => {
    blackbox(JSON.parse(payload));
  },
  JS_NATIVE_PARSE_OPS,
  utf8ByteLength(payload),
);
dumpToFile("multilib-native-json", "deserialize");
