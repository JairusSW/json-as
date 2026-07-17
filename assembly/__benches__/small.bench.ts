import { JSON } from "..";
import { expect } from "../__tests__/lib";
import {
  bench,
  blackbox,
  ChangingPayloads,
  dumpToFile,
  utf8ByteLength,
} from "./lib/bench";
import { nonDefaultValues } from "./lib/nondefault";


@json
class SessionStatusResponse {
  authenticated: boolean = true;
  user_id: i32 = 8472;
  username: string = "jairus";
  role: string = "admin";
  expires_at: string = "2025-12-23T04:30:00Z";
}
const v1 = new SessionStatusResponse();
const v2: string = JSON.stringify<SessionStatusResponse>(v1);
const nonDefaultJson = nonDefaultValues(v2);
const nonDefaultValue = JSON.parse<SessionStatusResponse>(nonDefaultJson);
const defaultPayloads = new ChangingPayloads(v2);
const nonDefaultPayloads = new ChangingPayloads(nonDefaultJson);
const objPayloads = new ChangingPayloads(v2);
const byteLength: usize = utf8ByteLength(v2);
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<SessionStatusResponse>(v2))).toBe(v2);
expect(JSON.stringify(nonDefaultValue)).toBe(nonDefaultJson);
bench(
  "Serialize Small API Response",
  () => {
    blackbox(JSON.stringify<SessionStatusResponse>(v1));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "serialize");
bench(
  "Deserialize Small API Response",
  () => {
    blackbox(JSON.parse<SessionStatusResponse>(defaultPayloads.next()));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "deserialize");

bench(
  "Serialize Small API Response (non-default)",
  () => {
    blackbox(JSON.stringify<SessionStatusResponse>(nonDefaultValue));
  },
  5_000_000,
  utf8ByteLength(nonDefaultJson),
);
dumpToFile("small-nondefault", "serialize");
bench(
  "Deserialize Small API Response (non-default)",
  () => {
    blackbox(JSON.parse<SessionStatusResponse>(nonDefaultPayloads.next()));
  },
  5_000_000,
  utf8ByteLength(nonDefaultJson),
);
dumpToFile("small-nondefault", "deserialize");

// Dynamic JSON.Obj variant of the same payload (typed struct vs JSON.Obj).
const objSmall = JSON.parse<JSON.Obj>(v2);
bench(
  "Serialize Small (JSON.Obj)",
  () => {
    blackbox(JSON.stringify(objSmall));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small-obj", "serialize");
bench(
  "Deserialize Small (JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(objPayloads.next()));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small-obj", "deserialize");
