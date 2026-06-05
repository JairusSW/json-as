import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { payloadBytes, STRUCT_STRINGIFY_OPS, structValueLazy } from "./shared";

bench(
  "Serialize Multilib Payload (json-as struct, lazy auto)",
  () => {
    blackbox(JSON.stringify(structValueLazy));
  },
  STRUCT_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-lazy", "serialize");
