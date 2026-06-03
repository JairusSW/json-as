import { blackbox, bench, dumpToFile } from "../lib/bench";
import { ASJ_STRINGIFY_OPS, payloadBytes, asjValue } from "./shared";

bench(
  "Serialize Multilib Payload (assemblyscript-json)",
  () => {
    blackbox(asjValue.stringify());
  },
  ASJ_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-assemblyscript-json", "serialize");
