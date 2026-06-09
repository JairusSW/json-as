import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench";


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
const byteLength: usize = utf8ByteLength(v2);
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<SessionStatusResponse>(v2))).toBe(v2);
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
    blackbox(JSON.parse<SessionStatusResponse>(v2));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "deserialize");

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
    blackbox(JSON.parse<JSON.Obj>(v2));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small-obj", "deserialize");
