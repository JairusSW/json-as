import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { JSON_OBJ_STRINGIFY_OPS, objValue, payloadBytes } from "./shared";

bench(
  "Serialize Multilib Payload (json-as JSON.Obj)",
  () => {
    blackbox(JSON.stringify(objValue));
  },
  JSON_OBJ_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-obj", "serialize");
