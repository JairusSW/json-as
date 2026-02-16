import { JSON } from "../";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { bench, blackbox, dumpToFile } from "./lib/bench";
import { expect } from "../__tests__/lib";

// SWAR quote detection: finds " (0x22) in a u64 block of 4 UTF-16 code units
// @ts-ignore: decorator
@inline function quote_mask(block: u64): u64 {
  const b = block ^ 0x0022_0022_0022_0022;
  return (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
}

@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";

  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
    do {
      // Minimum size: {"uid":0,"token":""} = 20 chars = 40 bytes
      if (srcEnd - srcStart <= 40) break;

      // --- Field 0: validate {"uid": at srcStart (7 chars = 14 bytes) ---
      if (!(
        load<u64>(srcStart, 0) == 0x6900750022007b &&  // {"ui
        load<u32>(srcStart, 8) == 0x220064 &&           // d"
        load<u16>(srcStart, 12) == 58                   // :
      )) break;
      srcStart += 14;

      // Parse uid (u32) inline: scan digits until non-digit
      {
        let val: u32 = <u32>(load<u16>(srcStart) - 48);
        srcStart += 2;
        while (<u32>load<u16>(srcStart) - 48 < 10) {
          val = val * 10 + <u32>(load<u16>(srcStart) - 48);
          srcStart += 2;
        }
        store<u32>(changetype<usize>(out), val, offsetof<this>("uid"));
      }

      // --- Field 1: validate ,"token": at srcStart (9 chars = 18 bytes) ---
      if (!(
        load<u64>(srcStart, 0) == 0x6f00740022002c &&   // ,"to
        load<u64>(srcStart, 8) == 0x22006e0065006b &&    // ken"
        load<u16>(srcStart, 16) == 58                    // :
      )) break;
      srcStart += 18;

      // Parse string value inline: skip opening ", find closing " via SWAR, then memory.copy
      {
        if (load<u16>(srcStart) != 34) break; // expect opening "
        
        const strStart = srcStart + 2; // past opening "
        srcStart += 2;

        // SWAR scan: find closing " in 8-byte (4 char) chunks
        const srcEnd8 = srcEnd - 8;
        while (srcStart <= srcEnd8) {
          const mask = quote_mask(load<u64>(srcStart));
          if (mask != 0) {
            srcStart += usize(ctz(mask) >> 3);
            break;
          }
          srcStart += 8;
        }
        // Scalar fallback for remaining bytes
        while (load<u16>(srcStart) != 34) srcStart += 2;

        const strLen = <u32>(srcStart - strStart);
        srcStart += 2; // skip closing "

        // Reuse existing string if same byte length, otherwise allocate
        let existing = load<usize>(changetype<usize>(out), offsetof<this>("token"));
        let strPtr: usize;
        if (existing != 0 && changetype<OBJECT>(existing - TOTAL_OVERHEAD).rtSize == strLen) {
          strPtr = existing;
        } else {
          strPtr = __new(strLen, idof<string>());
          store<usize>(changetype<usize>(out), strPtr, offsetof<this>("token"));
        }
        memory.copy(strPtr, strStart, strLen);
      }

      // Expect closing }
      if (load<u16>(srcStart) != 125) break;
      return out;
    } while (false);
    throw new Error("Failed to parse JSON");
  }
}

const tok = new Token();

const objStr = '{"uid":256,"token":"dewf32df@#G43g3Gs!@3sdfDS#2"}';
expect(JSON.stringify(tok)).toBe(objStr);
expect(JSON.stringify(JSON.parse<Token>(objStr))).toBe(objStr);

const objStrEnd = changetype<usize>(objStr) + (objStr.length << 1);

bench("Deserialize Token Object", () => {
    blackbox<Token>(JSON.parse<Token>(objStr));
    // @ts-ignore
    // tok.__DESERIALIZE<Token>(changetype<usize>(objStr), objStrEnd, tok);
}, 10_000_000, objStr.length << 1);
dumpToFile("token", "deserialize");
