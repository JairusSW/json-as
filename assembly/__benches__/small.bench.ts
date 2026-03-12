import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { deserializeStringToField_SWAR } from "../deserialize/swar/string";
import { atoi } from "../util/atoi";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const TRUE_WORD: u64 = 28429475166421108;
const FALSE_WORD: u64 = 32370086184550502;


@json
class SessionStatusResponse {
  authenticated: boolean = true;
  user_id: i32 = 8472;
  username: string = "jairus";
  role: string = "admin";
  expires_at: string = "2025-12-23T04:30:00Z";


  @inline
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {
    const dst = changetype<usize>(out);

    do {
      if (load<u64>(srcStart, 0) != 32932988889202811 || load<u64>(srcStart, 8) != 30962681236684916 || load<u64>(srcStart, 16) != 27303497949577332 || load<u64>(srcStart, 24) != 9570578711511156 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      if (load<u64>(srcStart) == TRUE_WORD) {
        store<bool>(dst + offsetof<this>("authenticated"), true);
        srcStart += 8;
      } else if (load<u64>(srcStart) == FALSE_WORD && load<u16>(srcStart, 8) == 101) {
        store<bool>(dst + offsetof<this>("authenticated"), false);
        srcStart += 10;
      } else break;

      if (load<u64>(srcStart, 0) != 32370124835127340 || load<u64>(srcStart, 8) != 29555280583983205 || load<u32>(srcStart, 16) != 2228324 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      {
        const valueStart = srcStart;
        if (load<u16>(srcStart) == 45) {
          srcStart += 2;
          if (srcStart >= srcEnd) break;
        }

        let digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        srcStart += 2;

        while (srcStart < srcEnd) {
          digit = <u32>load<u16>(srcStart) - 48;
          if (digit > 9) break;
          srcStart += 2;
        }

        store<i32>(dst + offsetof<this>("user_id"), atoi<i32>(valueStart, srcStart));
      }

      if (load<u64>(srcStart, 0) != 32370124835127340 || load<u64>(srcStart, 8) != 27303545194807397 || load<u64>(srcStart, 16) != 16325694684725357) break;
      srcStart = deserializeStringToField_SWAR<string>(srcStart + 24, srcEnd, dst + offsetof<this>("username"));

      if (load<u64>(srcStart, 0) != 31244212043382828 || load<u64>(srcStart, 8) != 16325694684725356) break;
      srcStart = deserializeStringToField_SWAR<string>(srcStart + 16, srcEnd, dst + offsetof<this>("role"));

      if (load<u64>(srcStart, 0) != 33777430999203884 || load<u64>(srcStart, 8) != 28429462280929392 || load<u64>(srcStart, 16) != 32651513916489843 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart = deserializeStringToField_SWAR<string>(srcStart + 28, srcEnd, dst + offsetof<this>("expires_at"));

      if (load<u16>(srcStart) != 125) break;
      return srcStart + 2;
    } while (false);

    throw new Error("Failed to parse JSON");
  }
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
