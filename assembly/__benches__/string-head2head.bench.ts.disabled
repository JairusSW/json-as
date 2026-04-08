import { bs } from "../../lib/as-bs";
import { expect } from "../__tests__/lib";
import { deserializeString_SWAR, deserializeStringField_SWAR as deserializeStringField_SWAR_Split } from "../deserialize/swar/string";
import { BACK_SLASH, QUOTE } from "../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../globals/tables";
import { hex4_to_u16_swar } from "../util/swar";
import { bench, blackbox, dumpToFile } from "./lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-expect-error: @inline is a valid decorator
@inline function writeStringToFieldMerged(dstFieldPtr: usize, srcStart: usize, byteLength: u32): void {
  const current = load<usize>(dstFieldPtr);
  let outPtr: usize;
  if (current != 0 && changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength) {
    outPtr = current;
  } else if (current != 0 && current != changetype<usize>("")) {
    outPtr = __renew(current, byteLength);
    store<usize>(dstFieldPtr, outPtr);
  } else {
    outPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, outPtr);
  }
  memory.copy(outPtr, srcStart, byteLength);
}

// @ts-expect-error: @inline is a valid decorator
@inline function backslash_or_quote_mask_merged(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) & 0x0080_0080_0080_0080;
}

// @ts-expect-error: @inline is a valid decorator
@inline function backslash_mask_unsafe_original(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  return (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
}

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeStringMemcpy_NoEscape(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const byteLength = srcEnd - srcStart;
  if (byteLength == 0) return changetype<string>("");
  // @ts-expect-error: __new is a runtime builtin
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

function deserializeString_SWAR_Original(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const srcEnd8 = srcEnd - 8;
  bs.ensureSize(u32(srcEnd - srcStart));

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = inline.always(backslash_mask_unsafe_original(block));
    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const dstIdx = bs.offset + laneIdx;
      const header = load<u32>(srcIdx);
      const code = <u16>(header >> 16);

      if ((header & 0xffff) !== 0x5c) continue;

      if (code !== 0x75) {
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - usize(escaped === 0x5c);
        store<u16>(dstIdx, escaped);
        store<u32>(dstIdx, load<u32>(srcIdx, 4), 2);

        const l6 = usize(laneIdx === 6);
        bs.offset -= (1 - l6) << 1;
        srcStart += l6 << 1;
        continue;
      }

      const block = load<u64>(srcIdx, 4);
      const escaped = hex4_to_u16_swar(block);
      store<u16>(dstIdx, escaped);
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

    if (block !== 0x5c) {
      bs.offset += 2;
      continue;
    }

    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      const block = load<u16>(srcStart);
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      const block = load<u64>(srcStart, 2);
      const escaped = hex4_to_u16_swar(block);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }

    bs.offset += 2;
  }
  return bs.out<string>();
}

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedStringScan_SWAR_SplitTuned(payloadStart: usize, escapeStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const srcEnd8 = srcEnd - 8;
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let lastPtr = escapeStart;
  let srcStart = escapeStart;

  while (srcStart <= srcEnd8) {
    const blockStart = srcStart;
    let mask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
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
        writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
        bs.offset = bs.buffer;
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
      writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
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

  bs.offset = bs.buffer;
  abort("Unterminated string literal");
  return srcStart;
}

function deserializeStringField_SWAR_SplitTuned(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd - 8;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
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
        writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;
      return inline.always(deserializeEscapedStringScan_SWAR_SplitTuned(payloadStart, srcIdx, srcEnd, dstFieldPtr));
    } while (mask !== 0);

    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return inline.always(deserializeEscapedStringScan_SWAR_SplitTuned(payloadStart, srcStart, srcEnd, dstFieldPtr));
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}

function deserializeStringField_SWAR_Merged(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= ~(0xffff << (laneIdx << 3));
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);

      if (char == QUOTE) {
        writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
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
          let escapedMask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
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
              writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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
            writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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
          let escapedMask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
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
              writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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
            writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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
      writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
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
          writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedStringContinuation_SWAR_MergedTuned(lastPtr: usize, srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  const srcEnd8 = srcEnd - 8;

  while (srcStart <= srcEnd8) {
    const blockStart = srcStart;
    let mask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
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
        writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
        bs.offset = bs.buffer;
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
    const tailChar = load<u16>(srcStart);
    if (tailChar == QUOTE) {
      const runLen = <u32>(srcStart - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }
      writeStringToFieldMerged(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
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

function deserializeStringField_SWAR_MergedTuned(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd - 8;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslash_or_quote_mask_merged(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= ~(0xffff << (laneIdx << 3));
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);

      if (char == QUOTE) {
        writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
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
      let lastPtr: usize;
      if (code !== 0x75) {
        store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
        bs.offset += 2;
        lastPtr = srcIdx + 4;
      } else {
        store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
        bs.offset += 2;
        lastPtr = srcIdx + 12;
      }
      return inline.always(deserializeEscapedStringContinuation_SWAR_MergedTuned(lastPtr, lastPtr, srcEnd, dstFieldPtr));
    } while (mask !== 0);

    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToFieldMerged(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
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

      const code = load<u16>(srcStart, 2);
      let lastPtr: usize;
      if (code !== 0x75) {
        store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
        bs.offset += 2;
        lastPtr = srcStart + 4;
      } else {
        store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
        bs.offset += 2;
        lastPtr = srcStart + 12;
      }
      return inline.always(deserializeEscapedStringContinuation_SWAR_MergedTuned(lastPtr, lastPtr, srcEnd, dstFieldPtr));
    }
    srcStart += 2;
  }

  return srcStart;
}

const plainInputs: string[] = ['"jairus Jairus Tanaka me@jairus.dev https://avatars.githubusercontent.com/u/123456?v=4 I like compilers elegant algorithms bare metal simd wasm https://jairus.dev/ Seattle WA 2020-01-15T08:30:00Z dark en-US America/Los_Angeles friends_only typescript webassembly performance assemblyscript json starred 2025-12-22T10:15:00Z assemblyscript/json-as commented issue #142 pushed main branch forked fast-json-wasm created new benchmark suite repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated"'];

const escapedInputs: string[] = ['"ab\\\\\\"cd line\\nfeed tab\\tindent quote: \\"hello\\" slash\\\\backslash unicode \\u263A face emoji \\uD83D\\uDE80 mix\\\\\\"\\n\\t\\u0041 repeated\\\\\\"chunk\\n\\t\\u0042 repeated\\\\\\"chunk\\n\\t\\u0043 repeated\\\\\\"chunk\\n\\t\\u0044 repeated\\\\\\"chunk\\n\\t\\u0045"'];

function totalBytesOf(values: string[]): u64 {
  let total: u64 = 0;
  for (let i = 0; i < values.length; i++) total += <u64>(unchecked(values[i]).length << 1);
  return total;
}

const VARIANT_BASELINE_SPLIT: i32 = 0;
const VARIANT_TUNED_SPLIT: i32 = 1;
const VARIANT_MERGED: i32 = 2;
const VARIANT_TUNED_MERGED: i32 = 3;

function runCorpus(values: string[], out: Array<string>, variant: i32): void {
  for (let i = 0; i < values.length; i++) {
    const value = unchecked(values[i]);
    const ptr = changetype<usize>(value);
    const end = ptr + (value.length << 1);
    const slot = out.dataStart + ((<usize>i) << alignof<string>());
    if (variant == VARIANT_MERGED) {
      blackbox(deserializeStringField_SWAR_Merged(ptr, end, slot));
    } else if (variant == VARIANT_TUNED_MERGED) {
      blackbox(deserializeStringField_SWAR_MergedTuned(ptr, end, slot));
    } else if (variant == VARIANT_TUNED_SPLIT) {
      blackbox(deserializeStringField_SWAR_SplitTuned(ptr, end, slot));
    } else {
      blackbox(deserializeStringField_SWAR_Split<string>(ptr, end, slot));
    }
  }
  blackbox(out);
}

const plainSplit = new Array<string>(plainInputs.length);
const plainSplitTuned = new Array<string>(plainInputs.length);
const plainMerged = new Array<string>(plainInputs.length);
const plainMergedTuned = new Array<string>(plainInputs.length);
const escapedSplit = new Array<string>(escapedInputs.length);
const escapedSplitTuned = new Array<string>(escapedInputs.length);
const escapedMerged = new Array<string>(escapedInputs.length);
const escapedMergedTuned = new Array<string>(escapedInputs.length);

runCorpus(plainInputs, plainSplit, VARIANT_BASELINE_SPLIT);
runCorpus(plainInputs, plainSplitTuned, VARIANT_TUNED_SPLIT);
runCorpus(plainInputs, plainMerged, VARIANT_MERGED);
runCorpus(plainInputs, plainMergedTuned, VARIANT_TUNED_MERGED);
runCorpus(escapedInputs, escapedSplit, VARIANT_BASELINE_SPLIT);
runCorpus(escapedInputs, escapedSplitTuned, VARIANT_TUNED_SPLIT);
runCorpus(escapedInputs, escapedMerged, VARIANT_MERGED);
runCorpus(escapedInputs, escapedMergedTuned, VARIANT_TUNED_MERGED);

const plainDirect = deserializeString_SWAR(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1));
const escapedDirect = deserializeString_SWAR(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1));
const plainDirectOriginal = deserializeString_SWAR_Original(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1));
const escapedDirectOriginal = deserializeString_SWAR_Original(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1));
const plainMemcpy = deserializeStringMemcpy_NoEscape(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1));

for (let i = 0; i < plainInputs.length; i++) {
  expect(unchecked(plainSplit[i])).toBe(unchecked(plainSplitTuned[i]));
  expect(unchecked(plainSplit[i])).toBe(unchecked(plainMerged[i]));
  expect(unchecked(plainSplit[i])).toBe(unchecked(plainMergedTuned[i]));
}

for (let i = 0; i < escapedInputs.length; i++) {
  expect(unchecked(escapedSplit[i])).toBe(unchecked(escapedSplitTuned[i]));
  expect(unchecked(escapedSplit[i])).toBe(unchecked(escapedMerged[i]));
  expect(unchecked(escapedSplit[i])).toBe(unchecked(escapedMergedTuned[i]));
}
expect(plainDirect).toBe(unchecked(plainSplit[0]));
expect(escapedDirect).toBe(unchecked(escapedSplit[0]));
expect(plainDirectOriginal).toBe(unchecked(plainSplit[0]));
expect(escapedDirectOriginal).toBe(unchecked(escapedSplit[0]));
expect(plainMemcpy).toBe(unchecked(plainSplit[0]));

const plainBytes = totalBytesOf(plainInputs);
const escapedBytes = totalBytesOf(escapedInputs);

bench(
  "String SWAR Head-to-Head Split Plain",
  () => {
    runCorpus(plainInputs, plainSplit, VARIANT_BASELINE_SPLIT);
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-split-plain", "deserialize");

bench(
  "String SWAR Head-to-Head Split Tuned Plain",
  () => {
    runCorpus(plainInputs, plainSplitTuned, VARIANT_TUNED_SPLIT);
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-split-tuned-plain", "deserialize");

bench(
  "String SWAR Head-to-Head Merged Plain",
  () => {
    runCorpus(plainInputs, plainMerged, VARIANT_MERGED);
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-merged-plain", "deserialize");

bench(
  "String SWAR Head-to-Head Merged Tuned Plain",
  () => {
    runCorpus(plainInputs, plainMergedTuned, VARIANT_TUNED_MERGED);
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-merged-tuned-plain", "deserialize");

bench(
  "String SWAR Direct Plain",
  () => {
    blackbox(deserializeString_SWAR(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1)));
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-direct-plain", "deserialize");

bench(
  "String SWAR Direct Original Plain",
  () => {
    blackbox(deserializeString_SWAR_Original(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1)));
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-direct-original-plain", "deserialize");

bench(
  "String SWAR Direct Memcpy Plain",
  () => {
    blackbox(deserializeStringMemcpy_NoEscape(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1)));
  },
  1_000_000,
  plainBytes,
);
dumpToFile("string-head2head-direct-memcpy-plain", "deserialize");

bench(
  "String SWAR Head-to-Head Split Escaped",
  () => {
    runCorpus(escapedInputs, escapedSplit, VARIANT_BASELINE_SPLIT);
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-split-escaped", "deserialize");

bench(
  "String SWAR Head-to-Head Split Tuned Escaped",
  () => {
    runCorpus(escapedInputs, escapedSplitTuned, VARIANT_TUNED_SPLIT);
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-split-tuned-escaped", "deserialize");

bench(
  "String SWAR Head-to-Head Merged Escaped",
  () => {
    runCorpus(escapedInputs, escapedMerged, VARIANT_MERGED);
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-merged-escaped", "deserialize");

bench(
  "String SWAR Head-to-Head Merged Tuned Escaped",
  () => {
    runCorpus(escapedInputs, escapedMergedTuned, VARIANT_TUNED_MERGED);
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-merged-tuned-escaped", "deserialize");

bench(
  "String SWAR Direct Escaped",
  () => {
    blackbox(deserializeString_SWAR(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1)));
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-direct-escaped", "deserialize");

bench(
  "String SWAR Direct Original Escaped",
  () => {
    blackbox(deserializeString_SWAR_Original(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1)));
  },
  1_000_000,
  escapedBytes,
);
dumpToFile("string-head2head-direct-original-escaped", "deserialize");
