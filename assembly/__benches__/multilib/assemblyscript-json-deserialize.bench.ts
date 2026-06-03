import { blackbox, bench, dumpToFile } from "../lib/bench";
import { JSON as ASJ } from "assemblyscript-json/assembly";
import { ASJ_DESERIALIZE_OPS, payload, payloadBytes } from "./shared";

bench(
  "Deserialize Multilib Payload (assemblyscript-json)",
  () => {
    blackbox(ASJ.parse<string>(payload));
  },
  ASJ_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-assemblyscript-json", "deserialize");
