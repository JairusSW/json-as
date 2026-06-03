import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { JSON_OBJ_DESERIALIZE_OPS, payload, payloadBytes } from "./shared";

bench(
  "Deserialize Multilib Payload (json-as JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(payload));
  },
  JSON_OBJ_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-obj", "deserialize");
