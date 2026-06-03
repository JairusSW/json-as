import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench.js";
import { JS_NATIVE_STRINGIFY_OPS, MULTILIB_PAYLOAD_FILE } from "./shared.js";

const payload = readFile(MULTILIB_PAYLOAD_FILE);
const obj = JSON.parse(payload);

bench(
  "Serialize Multilib Payload (native JSON)",
  () => {
    blackbox(JSON.stringify(obj));
  },
  JS_NATIVE_STRINGIFY_OPS,
  utf8ByteLength(payload),
);
dumpToFile("multilib-native-json", "serialize");
