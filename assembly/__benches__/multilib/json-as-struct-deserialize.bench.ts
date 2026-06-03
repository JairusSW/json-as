import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import {
  Repo,
  payload,
  payloadBytes,
  payloadEnd,
  payloadStart,
  STRUCT_DESERIALIZE_OPS,
  structValue,
} from "./shared";

bench(
  "Deserialize Multilib Payload (json-as struct)",
  () => {
    blackbox(JSON.parse<Repo>(payload));
    // blackbox(
    //   JSON.__deserialize<Repo>(
    //     payloadStart,
    //     payloadEnd,
    //     changetype<usize>(structValue),
    //   ),
    // );
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct", "deserialize");
