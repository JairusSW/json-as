import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { payloadBytes, STRUCT_STRINGIFY_OPS, structValue } from "./shared";

// Allocate the output string once, then reuse it on every iteration via the
// `out` param. Same shape -> same length -> in-place overwrite, so this loop
// should allocate ~nothing after the first call.
let out = JSON.stringify(structValue);

bench(
  "Serialize Multilib Payload (json-as struct, reuse)",
  () => {
    out = blackbox(JSON.stringify(structValue, out));
    blackbox(out);
  },
  STRUCT_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-reuse", "serialize");
