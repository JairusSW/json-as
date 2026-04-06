import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { bs } from "../../../lib/as-bs";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE, ESCAPE_HEX_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";

// @ts-ignore: inline
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

// @ts-ignore: inline
@inline export function deserializeString(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(u32(srcEnd - srcStart));

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

// @ts-ignore: inline
@inline export function deserializeStringField<T extends string | null>(srcStart: usize, srcEnd: usize, dstObj: usize, dstOffset: usize = 0): usize {
  const dstFieldPtr = dstObj + dstOffset;
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  srcStart = payloadStart;

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      srcStart += 2;
      continue;
    }

    const outStart = bs.offset - bs.buffer;
    bs.ensureSize(u32(srcEnd - payloadStart));
    const prefixLen = <u32>(srcStart - payloadStart);
    if (prefixLen != 0) {
      memory.copy(bs.offset, payloadStart, prefixLen);
      bs.offset += prefixLen;
    }

    while (srcStart < srcEnd) {
      const block = load<u16>(srcStart);
      if (block == QUOTE) {
        bs.toField(outStart, dstFieldPtr);
        return srcStart + 2;
      }

      if (block != BACK_SLASH) {
        store<u16>(bs.offset, block);
        srcStart += 2;
        bs.offset += 2;
        continue;
      }

      srcStart += 2;
      const code = load<u16>(srcStart);
      if (code !== 0x75) {
        const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        store<u16>(bs.offset, escape);
        srcStart += 2;
      } else {
        const escaped = hex4_to_u16_swar(load<u64>(srcStart, 2));
        store<u16>(bs.offset, escaped);
        srcStart += 10;
      }
      bs.offset += 2;
    }

    bs.offset = bs.buffer + outStart;
    break;
  }

  abort("Unterminated string literal");
  return srcStart;
}
