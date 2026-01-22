import {
  bs
} from "../lib/as-bs";
import {
  JSON
} from "./";
import { deserializeInteger } from "./deserialize/simple/integer";

console.log(load<u64>(changetype<usize>('{"x"')).toString(16))
@json
class Vec3 {
  x: u32 = 0;
  y: u32 = 0;
  z: u32 = 0;
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(92);
    store<u64>(bs.offset, 9570664606466171, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("x")));
    store<u64>(bs.offset, 9570668901433388, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("y")));
    store<u64>(bs.offset, 9570673196400684, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("z")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    return this;
  }
  __DESERIALIZE_FAST(srcStart: usize, srcEnd: usize, out: Vec3): Vec3 | null {
    if (load<u64>(srcStart) !== 0x2200780022007b && load<u16>(srcStart, 10) !== 0x3a) return null; // {"x" & :
    deserializeInteger<u32>(srcStart + 12, srcStart)

    return new Vec3();
  }
  }
//   @inline
//   __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
//     let keyStart: usize = 0;
//     let keyEnd: usize = 0;
//     let isKey = false;
//     let depth: i32 = 0;
//     let lastIndex: usize = 0;
//     while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;
//     while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
//     if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");
// ;
//     if (load<u16>(srcStart) != 123) throw new Error("Expected '{' at start of object at position " + (srcEnd - srcStart).toString());
// ;
//     if (load<u16>(srcEnd - 2) != 125) throw new Error("Expected '}' at end of object at position " + (srcEnd - srcStart).toString());
// ;
//     srcStart += 2;
//     while (srcStart < srcEnd) {
//       let code = load<u16>(srcStart);
//       while (JSON.Util.isSpace(code)) code = load<u16>(srcStart += 2);
//       if (keyStart == 0) {
//         if (code == 34 && load<u16>(srcStart - 2) !== 92) {
//           if (isKey) {
//             keyStart = lastIndex;
//             keyEnd = srcStart;
//             while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) {}
//             if (code !== 58) throw new Error("Expected ':' after key at position " + (srcEnd - srcStart).toString());
// ;
//             isKey = false;
//           } else {
//             isKey = true;
//             lastIndex = srcStart + 2;
//           }
//         }
//         srcStart += 2;
//       } else {
//         if (code == 34) {
//           lastIndex = srcStart;
//           srcStart += 2;
//           while (srcStart < srcEnd) {
//             const code = load<u16>(srcStart);
//             if (code == 34 && load<u16>(srcStart - 2) !== 92) {
//               srcStart += 4;
//               keyStart = 0;
//               break;
//             }
//             srcStart += 2;
//           }
//         } else if (code - 48 <= 9 || code == 45) {
//           lastIndex = srcStart;
//           srcStart += 2;
//           while (srcStart < srcEnd) {
//             const code = load<u16>(srcStart);
//             if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {
//               switch (<u32>keyEnd - <u32>keyStart) {
//                 case 2:
//                   {
//                     const code16 = load<u16>(keyStart);
//                     if (code16 == 120) {
//                       store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("x"));
//                       srcStart += 2;
//                       keyStart = 0;
//                       break;
//                     } else if (code16 == 121) {
//                       store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("y"));
//                       srcStart += 2;
//                       keyStart = 0;
//                       break;
//                     } else if (code16 == 122) {
//                       store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("z"));
//                       srcStart += 2;
//                       keyStart = 0;
//                       break;
//                     } else {
//                       srcStart += 2;
//                       keyStart = 0;
//                       break;
//                     }
//                   }

//                 default:
//                   {
//                     srcStart += 2;
//                     keyStart = 0;
//                     break;
//                   }

// }
//               break;
//             }
//             srcStart += 2;
//           }
//         } else if (code == 123) {
//           lastIndex = srcStart;
//           depth++;
//           srcStart += 2;
//           while (srcStart < srcEnd) {
//             const code = load<u16>(srcStart);
//             if (code == 34) {
//               srcStart += 2;
//               while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;
//             } else if (code == 125) {
//               if (--depth == 0) {
//                 srcStart += 2;
//                 switch (<u32>keyEnd - <u32>keyStart) {
//                   case 2:
//                     {
//                       const code16 = load<u16>(keyStart);
//                       if (code16 == 120) {
//                         store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("x"));
//                         keyStart = 0;
//                         break;
//                       } else if (code16 == 121) {
//                         store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("y"));
//                         keyStart = 0;
//                         break;
//                       } else if (code16 == 122) {
//                         store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("z"));
//                         keyStart = 0;
//                         break;
//                       } else {
//                         keyStart = 0;
//                         break;
//                       }
//                     }

//                   default:
//                     {
//                       keyStart = 0;
//                       break;
//                     }

// }
//                 break;
//               }
//             } else if (code == 123) depth++;
// ;
//             srcStart += 2;
//           }
//         } else if (code == 91) {
//           lastIndex = srcStart;
//           depth++;
//           srcStart += 2;
//           while (srcStart < srcEnd) {
//             const code = load<u16>(srcStart);
//             if (code == 34) {
//               srcStart += 2;
//               while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;
//             } else if (code == 93) {
//               if (--depth == 0) {
//                 srcStart += 2;
//                 keyStart = 0;
//                 break;
//               }
//             } else if (code == 91) depth++;
// ;
//             srcStart += 2;
//           }
//         } else if (code == 116) {
//           if (load<u64>(srcStart) == 28429475166421108) {
//             srcStart += 8;
//             srcStart += 2;
//             keyStart = 0;
//           } else {
//             throw new Error("Expected to find 'true' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
//           }
//         } else if (code == 102) {
//           if (load<u64>(srcStart, 2) == 28429466576093281) {
//             srcStart += 10;
//             srcStart += 2;
//             keyStart = 0;
//           } else {
//             throw new Error("Expected to find 'false' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
//           }
//         } else if (code == 110) {
//           if (load<u64>(srcStart) == 30399761348886638) {
//             srcStart += 8;
//             srcStart += 2;
//             keyStart = 0;
//           }
//         } else {
//           srcStart += 2;
//           keyStart = 0;
//         }
//       }
//     }
//     return out;
//   }
// }


@inline
export function atoi<T>(srcStart: usize, srcEnd: usize): T {
  let p = srcStart;
  let neg = false;

  if (isSigned<T>()) {
    if (load<u16>(p) == 45) { // '-'
      neg = true;
      p += 2;
    }
  }

  // @ts-ignore
  let val: T = 0;

  // ---- 4-digit SWAR loop ----
  const ASCII0 = 0x0030003000300030;
  const ASCII9 = 0x0039003900390039;

  while (p + 8 <= srcEnd) {
    let x = load<u64>(p);

    // Check all 4 are digits
    // if any lane < '0' or > '9' -> break
    if (x < ASCII0) break;
    if (x > ASCII9) break;

    // Normalize to 0..9
    x -= ASCII0;

    // Extract lanes
    let d0 = <u32>( x        & 0xFFFF);
    let d1 = <u32>((x >> 16) & 0xFFFF);
    let d2 = <u32>((x >> 32) & 0xFFFF);
    let d3 = <u32>((x >> 48) & 0xFFFF);

    let chunk = d0 * 1000 + d1 * 100 + d2 * 10 + d3;

    // val = val * 10000 + chunk
    // @ts-ignore
    val = (val * 10000 + chunk) as T;

    p += 8; // 4 UTF-16 chars
  }

  // ---- Scalar tail ----
  while (p < srcEnd) {
    let c = load<u16>(p);
    if (c < 48 || c > 57) break;

    // @ts-ignore
    val = (val * 10 + (c - 48)) as T;
    p += 2;
  }

  // @ts-ignore
  return neg ? -val as T : val as T;
}
