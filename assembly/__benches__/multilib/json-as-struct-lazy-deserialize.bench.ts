import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { RepoLazy, payload, payloadBytes, STRUCT_DESERIALIZE_OPS } from "./shared";

bench(
  "Deserialize Multilib Payload (json-as struct, lazy auto)",
  () => {
    blackbox(JSON.parse<RepoLazy>(payload));
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-lazy", "deserialize");
