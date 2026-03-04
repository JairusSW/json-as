import { JSON } from "./";
import { deserializeUintScan } from "./deserialize/helpers/uint";
import { deserializeStringScan_SWAR, deserializeString_SWAR, deserializeString_SWAR_TO } from "./deserialize/swar/string";
import { bytes } from "./util";


@json
class SessionStatusResponse {
  authenticated: boolean = true;
  user_id: i32 = 8472;
  username: string = "jairus";
  role: string = "admin";
  expires_at: string = "2025-12-23T04:30:00Z";
}

const tok = new SessionStatusResponse();
const serialized = JSON.stringify(tok);
console.log("Serialized:   " + serialized);
const deserialized = tok.__DESERIALIZE_FAST<SessionStatusResponse>(changetype<usize>(serialized), changetype<usize>(serialized) + bytes(serialized), tok); //JSON.parse<Token>(serialized);
console.log("Deserialized: " + JSON.stringify(deserialized));
