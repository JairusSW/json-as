import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { Repo, payload, payloadBytes, STRUCT_DESERIALIZE_OPS } from "./shared";

// Allocate the target graph once, then reuse it on every iteration via
// parseInto. After the first parse the fast path reuses every field, so this
// loop should allocate ~nothing — isolating allocator cost from parse cost.
const target = JSON.parse<Repo>(payload);

bench(
  "Deserialize Multilib Payload (json-as struct, reuse)",
  () => {
    blackbox(JSON.parse<Repo>(payload, target));
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-reuse", "deserialize");
