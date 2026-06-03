import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { payloadBytes, STRUCT_STRINGIFY_OPS, structValue } from "./shared";

bench(
  "Serialize Multilib Payload (json-as struct)",
  () => {
    blackbox(JSON.stringify(structValue));
  },
  STRUCT_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct", "serialize");
