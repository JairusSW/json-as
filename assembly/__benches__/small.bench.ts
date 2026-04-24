import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";


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
const byteLength: usize = v2.length;
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<SessionStatusResponse>(v2))).toBe(v2);
bench(
  "Serialize Small API Response",
  () => {
    blackbox(inline.always(JSON.stringify<SessionStatusResponse>(v1)));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "serialize");
bench(
  "Deserialize Small API Response",
  () => {
    blackbox(inline.always(JSON.parse<SessionStatusResponse>(v2)));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "deserialize");
