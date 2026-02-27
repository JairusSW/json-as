import { JSON } from "./";
import { deserializeUintScan } from "./deserialize/helpers/uint";
import { deserializeStringScan_SWAR } from "./deserialize/swar/string";
import { bytes } from "./util";


@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
  __DESERIALIZE_FAST<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
    const dst = changetype<usize>(out);
    const uidPtr = dst + offsetof<this>("uid");
    const tokenPtr = dst + offsetof<this>("token");

    do {
      if (srcEnd - srcStart < 40) break;

      if (
        // {"uid":
        load<u64>(srcStart, 0) != 0x6900750022007b &&
        load<u32>(srcStart, 8) != 0x220064 &&
        load<u16>(srcStart, 12) != 0x3a
      )
        break;
      srcStart += 14;

      srcStart = deserializeUintScan<u32>(srcStart, dst + offsetof<this>("uid"));

      if (
        // ,"token":
        load<u64>(srcStart, 0) != 0x6f00740022002c &&
        load<u64>(srcStart, 8) != 0x22006e0065006b &&
        load<u16>(srcStart, 16) != 0x3a
      )
        break;
      srcStart += 18;

      srcStart = deserializeStringScan_SWAR(srcStart, srcEnd, dst + offsetof<this>("token"));
      return out;
    } while (false);

    throw new Error("Failed to parse JSON!");
  }
}

const tok = new Token();
const serialized = JSON.stringify(tok);
console.log("Serialized:   " + serialized);
const deserialized = tok.__DESERIALIZE_FAST<Token>(changetype<usize>(serialized), changetype<usize>(serialized) + bytes(serialized), tok); //JSON.parse<Token>(serialized);
console.log("Deserialized: " + JSON.stringify(deserialized));
