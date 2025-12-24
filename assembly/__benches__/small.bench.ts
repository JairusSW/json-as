import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

@json
class SessionStatusResponse {
  authenticated!: boolean;
  user_id!: i32;
  username!: string;
  role!: string;
  expires_at!: string;
}

const v1 = new SessionStatusResponse();

v1.authenticated = true;
v1.user_id = 8472;
v1.username = "jairus";
v1.role = "admin";
v1.expires_at = "2025-12-23T04:30:00Z";

const v2: string = JSON.stringify<SessionStatusResponse>(v1);
const byteLength: usize = v2.length << 1;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<SessionStatusResponse>(v2))).toBe(v2);

bench(
  "Serialize Small API Response",
  () => {
    blackbox(inline.always(JSON.stringify<SessionStatusResponse>(v1)));
  },
  5_000_000,
  byteLength
);
dumpToFile("small", "serialize")

bench(
  "Deserialize Small API Response",
  () => {
    blackbox(inline.always(JSON.parse<SessionStatusResponse>(v2)));
  },
  5_000_000,
  byteLength
);
dumpToFile("small", "deserialize")