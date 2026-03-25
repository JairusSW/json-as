import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";

// Overflow Pattern for Unicode Escapes (READ)
// \u0001     0 \u00|01__   + 4
// -\u0001    2 -\u0|001_   + 6
// --\u0001   4 --\u|0001   + 8
// ---\u0001  6 ---\|u0001  + 10
// Formula: overflow = lane + 4

// Overflow Pattern for Unicode Escapes (WRITE)
// * = escape, _ = empty
// \u0001     0 *___|       - 6
// -\u0001    2 -*__|       - 4
// --\u0001   4 --*_|       - 2
// ---\u0001  6 ---*|       - 0
// Formula: 6 - lane

// Overflow pattern for Short Escapes (READ)
// \n--       0 \n--|       + 0
// -\n        2 -\n-|       + 0
// --\n       4 --\n|       + 0
// ---\n      6 ---\|n      + 2
// Formula: overflow = |lane - 4|

// Overflow pattern for Short Escapes (WRITE)
// * = escape, _ = empty
// \n--       0 *--_       - 2
// -\n-       2 -*-_       - 2
// --\n       4 --*_       - 2
// ---\n      6 ---*       - 0
// Formula: overflow =

/**
 * Deserializes strings back into into their original form using SIMD operations
 * @param src string to deserialize
 * @param dst buffer to write to
 * @returns number of bytes written
 */
// @ts-expect-error: @inline is a valid decorator
@inline function copyStringFromSource(srcStart: usize, byteLength: usize): string {
  if (byteLength == 0) return changetype<string>("");
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedString_SWAR(payloadStart: usize, escapeStart: usize, srcEnd: usize): string {
  const srcEnd8 = srcEnd - 8;
  const prefixLen = <u32>(escapeStart - payloadStart);
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = inline.always(backslash_mask_unsafe(block));

    // Early exit
    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3); // 0 2 4 6
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const dstIdx = bs.offset + laneIdx;
      const header = load<u32>(srcIdx);
      const code = <u16>(header >> 16);

      // Detect false positive (code unit where low byte is 0x5C)
      if ((header & 0xffff) !== 0x5c) continue;

      // Hot path (negative bias)
      if (code !== 0x75) {
        // Short escapes (\n \t \" \\)
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - usize(escaped === 0x5c);
        store<u16>(dstIdx, escaped);
        store<u32>(dstIdx, load<u32>(srcIdx, 4), 2);

        const l6 = usize(laneIdx === 6);
        bs.offset -= (1 - l6) << 1;
        srcStart += l6 << 1;
        continue;
      }

      // Unicode escape (\uXXXX)
      const block = load<u64>(srcIdx, 4); // XXXX
      const escaped = hex4_to_u16_swar(block);
      store<u16>(dstIdx, escaped);
      // store<u64>(dstIdx, load<u32>(srcIdx, 12), 2);
      srcStart += 4 + laneIdx;
      bs.offset -= 6 - laneIdx;
    } while (mask !== 0);

    bs.offset += 8;
    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;

    // Early exit
    if (block !== 0x5c) {
      bs.offset += 2;
      continue;
    }

    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      // Short escapes (\n \t \" \\)
      const block = load<u16>(srcStart);
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      // Unicode escape (\uXXXX)
      const block = load<u64>(srcStart, 2); // XXXX
      const escaped = hex4_to_u16_swar(block);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }

    bs.offset += 2;
  }
  return bs.sliceOut<string>(outStart);
}

export function deserializeString_SWAR(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  const srcEnd8 = srcEnd - 8;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(backslash_mask_unsafe(block));

    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const header = load<u32>(srcIdx);

      // Detect false positive (code unit where low byte is 0x5C)
      if ((header & 0xffff) !== 0x5c) continue;

      return inline.always(deserializeEscapedString_SWAR(payloadStart, srcIdx, srcEnd));
    } while (mask !== 0);

    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BACK_SLASH) {
      return inline.always(deserializeEscapedString_SWAR(payloadStart, srcStart, srcEnd));
    }
    srcStart += 2;
  }

  return copyStringFromSource(payloadStart, srcEnd - payloadStart);
}

// /**
//  * Deserializes a quoted JSON string into a reused/renewed destination string buffer.
//  * @param srcStart pointer to opening quote
//  * @param srcEnd pointer to closing quote
//  * @param outPtr existing destination string pointer (or 0)
//  * @returns next unread source pointer
//  */
// export function deserializeString_SWAR_TO(srcStart: usize, srcEnd: usize, outPtr: usize): usize {
//   srcStart += 2;
//   let dst = outPtr;
//   const srcEnd8 = srcEnd - 8;
//   const byteSize = srcEnd - srcStart;
//   if (!dst) {
//     dst = __new(byteSize, idof<string>());
//   } else if (changetype<OBJECT>(dst - TOTAL_OVERHEAD).rtSize < <u32>byteSize) {
//     dst = __renew(dst, byteSize);
//   }
//   let offset = dst;

//   while (srcStart < srcEnd8) {
//     const block = load<u64>(srcStart);
//     store<u64>(offset, block);

//     let mask = inline.always(backslash_mask_unsafe(block));

//     if (mask === 0) {
//       srcStart += 8;
//       offset += 8;
//       continue;
//     }

//     do {
//       const laneIdx = usize(ctz(mask) >> 3); // 0 2 4 6
//       mask &= mask - 1;
//       const srcIdx = srcStart + laneIdx;
//       const dstIdx = offset + laneIdx;
//       const header = load<u32>(srcIdx);
//       const code = <u16>(header >> 16);

//       if ((header & 0xffff) !== 0x5c) continue;

//       if (code !== 0x75) {
//         const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
//         mask &= mask - usize(escaped === 0x5c);
//         store<u16>(dstIdx, escaped);
//         const copyStart = srcIdx + 4;
//         if (copyStart < srcEnd) {
//           const copyBytes = min<usize>(4, srcEnd - copyStart);
//           memory.copy(dstIdx + 2, copyStart, copyBytes);
//         }

//         const l6 = usize(laneIdx === 6);
//         offset -= (1 - l6) << 1;
//         srcStart += l6 << 1;
//         continue;
//       }

//       const block = load<u64>(srcIdx, 4); // XXXX
//       const escaped = hex4_to_u16_swar(block);
//       store<u16>(dstIdx, escaped);
//       srcStart += 4 + laneIdx;
//       offset -= 6 - laneIdx;
//     } while (mask !== 0);

//     offset += 8;
//     srcStart += 8;
//   }

//   while (srcStart < srcEnd) {
//     const block = load<u16>(srcStart);
//     store<u16>(offset, block);
//     srcStart += 2;

//     if (block !== 0x5c) {
//       offset += 2;
//       continue;
//     }

//     const code = load<u16>(srcStart);
//     if (code !== 0x75) {
//       const block = load<u16>(srcStart);
//       const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
//       store<u16>(offset, escape);
//       srcStart += 2;
//     } else {
//       const block = load<u64>(srcStart, 2); // XXXX
//       const escaped = hex4_to_u16_swar(block);
//       store<u16>(offset, escaped);
//       srcStart += 10;
//     }

//     offset += 2;
//   }
//   if (offset - dst != byteSize) {
//     dst = __renew(dst, offset - dst);
//   }
//   return srcEnd + 2;
// }

// Scans a quoted string value, writes into the destination field, and returns next unread src pointer.
// @ts-expect-error: @inline is a valid decorator
@inline function writeStringToField(dstFieldPtr: usize, srcStart: usize, byteLength: u32): void {
  if (byteLength == 0) {
    store<usize>(dstFieldPtr, changetype<usize>(""));
    return;
  }

  const current = load<usize>(dstFieldPtr);
  let stringPtr: usize;
  if (current != 0 && changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength) {
    stringPtr = current;
  } else if (current != 0 && current != changetype<usize>("")) {
    stringPtr = __renew(current, byteLength);
    store<usize>(dstFieldPtr, stringPtr);
  } else {
    stringPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, stringPtr);
  }
  memory.copy(stringPtr, srcStart, byteLength);
}

/*
export function deserializeStringField_SWAR<T extends string | null>(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslash_or_quote_mask(load<u64>(srcStart)));

    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= ~(0xffff << (laneIdx << 3));
      // since we clear the entire byte, we can guarentee that any discovered lane where char == QUOTE is unescaped and a terminator.
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);

      if (char == QUOTE) {
        writeStringToField(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;

      bs.offset = bs.buffer;
      bs.ensureSize(<u32>(srcEnd - payloadStart));
      const prefixLen = <u32>(srcIdx - payloadStart);
      if (prefixLen != 0) {
        memory.copy(bs.buffer, payloadStart, prefixLen);
        bs.offset += prefixLen;
      }

      const chunk = load<u32>(srcIdx);
      const code = <u16>(chunk >> 16);

      if (code !== 0x75) {
        store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
        bs.offset += 2;
        let lastPtr = srcIdx + 4;
        srcStart = lastPtr;
        while (srcStart <= srcEnd8) {
          const blockStart = srcStart;
          let escapedMask = inline.always(backslash_or_quote_mask(load<u64>(srcStart)));
          if (escapedMask === 0) {
            srcStart += 8;
            continue;
          }

          do {
            const escapedLaneIdx = usize(ctz(escapedMask) >> 3);
            escapedMask &= escapedMask - 1;
            const escapedIdx = srcStart + escapedLaneIdx;
            const escapedChar = load<u16>(escapedIdx);

            if (escapedChar == QUOTE) {
              const runLen = <u32>(escapedIdx - lastPtr);
              if (runLen != 0) {
                memory.copy(bs.offset, lastPtr, runLen);
                bs.offset += runLen;
              }
              writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
              bs.offset = bs.buffer;
              return escapedIdx + 2;
            }
            if (escapedChar != BACK_SLASH) continue;

            const runLen = <u32>(escapedIdx - lastPtr);
            if (runLen != 0) {
              memory.copy(bs.offset, lastPtr, runLen);
              bs.offset += runLen;
            }

            const escapedChunk = load<u32>(escapedIdx);
            const escapedCode = <u16>(escapedChunk >> 16);
            if (escapedCode !== 0x75) {
              store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + escapedCode));
              bs.offset += 2;
              lastPtr = escapedIdx + 4;
            } else {
              store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(escapedIdx, 4)));
              bs.offset += 2;
              lastPtr = escapedIdx + 12;
            }
            srcStart = lastPtr;
            break;
          } while (escapedMask !== 0);

          if (srcStart == blockStart) srcStart += 8;
        }

        while (srcStart < srcEnd) {
          const tailChar = load<u16>(srcStart);
          if (tailChar == QUOTE) {
            const runLen = <u32>(srcStart - lastPtr);
            if (runLen != 0) {
              memory.copy(bs.offset, lastPtr, runLen);
              bs.offset += runLen;
            }
            writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
            bs.offset = bs.buffer;
            return srcStart + 2;
          }
          if (tailChar != BACK_SLASH) {
            srcStart += 2;
            continue;
          }

          const runLen = <u32>(srcStart - lastPtr);
          if (runLen != 0) {
            memory.copy(bs.offset, lastPtr, runLen);
            bs.offset += runLen;
          }
          const tailCode = load<u16>(srcStart, 2);
          if (tailCode !== 0x75) {
            store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + tailCode));
            bs.offset += 2;
            srcStart += 4;
          } else {
            store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
            bs.offset += 2;
            srcStart += 12;
          }
          lastPtr = srcStart;
        }
        bs.offset = bs.buffer;
        return srcStart;
      } else {
        store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
        bs.offset += 2;
        let lastPtr = srcIdx + 12;
        srcStart = lastPtr;
        while (srcStart <= srcEnd8) {
          const blockStart = srcStart;
          let escapedMask = inline.always(backslash_or_quote_mask(load<u64>(srcStart)));
          if (escapedMask === 0) {
            srcStart += 8;
            continue;
          }

          do {
            const escapedLaneIdx = usize(ctz(escapedMask) >> 3);
            escapedMask &= escapedMask - 1;
            const escapedIdx = srcStart + escapedLaneIdx;
            const escapedChar = load<u16>(escapedIdx);

            if (escapedChar == QUOTE) {
              const runLen = <u32>(escapedIdx - lastPtr);
              if (runLen != 0) {
                memory.copy(bs.offset, lastPtr, runLen);
                bs.offset += runLen;
              }
              writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
              bs.offset = bs.buffer;
              return escapedIdx + 2;
            }
            if (escapedChar != BACK_SLASH) continue;

            const runLen = <u32>(escapedIdx - lastPtr);
            if (runLen != 0) {
              memory.copy(bs.offset, lastPtr, runLen);
              bs.offset += runLen;
            }

            const escapedChunk = load<u32>(escapedIdx);
            const escapedCode = <u16>(escapedChunk >> 16);
            if (escapedCode !== 0x75) {
              store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + escapedCode));
              bs.offset += 2;
              lastPtr = escapedIdx + 4;
            } else {
              store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(escapedIdx, 4)));
              bs.offset += 2;
              lastPtr = escapedIdx + 12;
            }
            srcStart = lastPtr;
            break;
          } while (escapedMask !== 0);

          if (srcStart == blockStart) srcStart += 8;
        }

        while (srcStart < srcEnd) {
          const tailChar = load<u16>(srcStart);
          if (tailChar == QUOTE) {
            const runLen = <u32>(srcStart - lastPtr);
            if (runLen != 0) {
              memory.copy(bs.offset, lastPtr, runLen);
              bs.offset += runLen;
            }
            writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
            bs.offset = bs.buffer;
            return srcStart + 2;
          }
          if (tailChar != BACK_SLASH) {
            srcStart += 2;
            continue;
          }

          const runLen = <u32>(srcStart - lastPtr);
          if (runLen != 0) {
            memory.copy(bs.offset, lastPtr, runLen);
            bs.offset += runLen;
          }
          const tailCode = load<u16>(srcStart, 2);
          if (tailCode !== 0x75) {
            store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + tailCode));
            bs.offset += 2;
            srcStart += 4;
          } else {
            store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
            bs.offset += 2;
            srcStart += 12;
          }
          lastPtr = srcStart;
        }
        bs.offset = bs.buffer;
        return srcStart;
      }
    } while (mask !== 0);
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      bs.offset = bs.buffer;
      bs.ensureSize(<u32>(srcEnd - payloadStart));
      const prefixLen = <u32>(srcStart - payloadStart);
      if (prefixLen != 0) {
        memory.copy(bs.buffer, payloadStart, prefixLen);
        bs.offset += prefixLen;
      }

      let lastPtr = srcStart;
      const code = load<u16>(srcStart, 2);
      if (code !== 0x75) {
        store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
        bs.offset += 2;
        srcStart += 4;
      } else {
        store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
        bs.offset += 2;
        srcStart += 12;
      }
      lastPtr = srcStart;

      while (srcStart < srcEnd) {
        const tailChar = load<u16>(srcStart);
        if (tailChar == QUOTE) {
          const runLen = <u32>(srcStart - lastPtr);
          if (runLen != 0) {
            memory.copy(bs.offset, lastPtr, runLen);
            bs.offset += runLen;
          }
          writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
          bs.offset = bs.buffer;
          return srcStart + 2;
        }
        if (tailChar != BACK_SLASH) {
          srcStart += 2;
          continue;
        }

        const runLen = <u32>(srcStart - lastPtr);
        if (runLen != 0) {
          memory.copy(bs.offset, lastPtr, runLen);
          bs.offset += runLen;
        }
        const tailCode = load<u16>(srcStart, 2);
        if (tailCode !== 0x75) {
          store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + tailCode));
          bs.offset += 2;
          srcStart += 4;
        } else {
          store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
          bs.offset += 2;
          srcStart += 12;
        }
        lastPtr = srcStart;
      }
      bs.offset = bs.buffer;
      return srcStart;
    }
    srcStart += 2;
  }

  return srcStart;
}
*/

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedStringScan_SWAR(payloadStart: usize, escapeStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let lastPtr = escapeStart;
  let srcStart = escapeStart;

  while (srcStart <= srcEnd8) {
    const blockStart = srcStart;
    let mask = inline.always(backslash_or_quote_mask(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char == QUOTE) {
        const runLen = <u32>(srcIdx - lastPtr);
        if (runLen != 0) {
          memory.copy(bs.offset, lastPtr, runLen);
          bs.offset += runLen;
        }
        bs.toField(outStart, dstFieldPtr);
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;

      const runLen = <u32>(srcIdx - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }

      const chunk = load<u32>(srcIdx);
      const code = <u16>(chunk >> 16);
      if (code !== 0x75) {
        store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
        bs.offset += 2;
        lastPtr = srcIdx + 4;
      } else {
        store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
        bs.offset += 2;
        lastPtr = srcIdx + 12;
      }
      srcStart = lastPtr;
      break;
    } while (mask !== 0);
    if (srcStart == blockStart) srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      const runLen = <u32>(srcStart - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }
      bs.toField(outStart, dstFieldPtr);
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      srcStart += 2;
      continue;
    }

    const runLen = <u32>(srcStart - lastPtr);
    if (runLen != 0) {
      memory.copy(bs.offset, lastPtr, runLen);
      bs.offset += runLen;
    }

    const code = load<u16>(srcStart, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart += 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
      bs.offset += 2;
      srcStart += 12;
    }

    lastPtr = srcStart;
  }

  bs.offset = bs.buffer + outStart;
  abort("Unterminated string literal");
  return srcStart;
}

// Scans a quoted string value, writes into the destination field, and returns next unread src pointer.
export function deserializeStringField_SWAR<T extends string | null>(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslash_or_quote_mask(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char == QUOTE) {
        writeStringToField(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;

      return deserializeEscapedStringScan_SWAR(payloadStart, srcIdx, srcEnd, dstFieldPtr);
    } while (mask !== 0);

    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return deserializeEscapedStringScan_SWAR(payloadStart, srcStart, srcEnd, dstFieldPtr);
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}

/**
 * Computes a per-byte mask identifying ASCII backslash or quote bytes.
 *
 * WARNING: Matches in the high byte of a UTF-16 code unit are not filtered,
 * so callers must confirm the hit scalarly.
 * Each matching lane sets itself to 0x80.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function backslash_or_quote_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) & 0x0080_0080_0080_0080;
}
/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * The mask is produced in two stages:
 * 1. Detects bytes equal to 0x5C using a SWAR equality test.
 * 2. Clears matches where 0x5C appears in the **high byte** of a UTF-16 code unit,
 *    ensuring only valid low-byte backslashes are reported.
 *
 * Each matching lane sets itself to 0x80.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function backslash_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  const high_byte_mask = ~(((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^ 0x8000_8000_8000_8000) >> 8;
  return backslash_mask & high_byte_mask;
}

/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * Each matching lane sets itself to 0x80.
 *
 * WARNING: The low byte of a code unit *may* be a backslash, thus triggering false positives!
 * This is useful for a hot path where it is possible to detect the false positive scalarly.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function backslash_mask_unsafe(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  return backslash_mask;
}
