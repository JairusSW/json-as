import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { JSON_OBJ_STRINGIFY_OPS, objValue, payloadBytes } from "./shared";

bench(
  "Serialize Multilib Payload (untouched JSON.Obj forwarding)",
  () => {
    blackbox(JSON.stringify(objValue));
  },
  JSON_OBJ_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-obj", "serialize");
