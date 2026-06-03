import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { serializeString_SWAR as serializeString_SWAR_Baseline } from "../../serialize/swar/string";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { u16_to_hex4_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// Head-to-head comparison: OLD = production 8-byte stride fast-path,
// NEW = candidate 16-byte wide-scan in the fast-path.
// Focus is pure-ASCII serialize, the dominant case for typical JSON.

// @ts-expect-error: @lazy
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy
@lazy const U_MARKER = 7667804;

// @ts-expect-error: @inline
@inline function detect_escapable_u64_swar_safe(block: u64): u64 {
  const hi = block & 0xff00_ff00_ff00_ff00;
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_mask =
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);
  if (hi == 0) return ascii_mask;
  const hi_mask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^
    0x8000_8000_8000_8000;
  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}

// @ts-expect-error: @inline
@inline function write_u_escape(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER);
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}

// --- Slow-path body shared by both candidates (verbatim from production). ---

// @ts-expect-error: @inline
@inline function slowPath(srcStart: usize, srcEnd: usize): void {
  const srcEnd8 = srcEnd - 8;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = detect_escapable_u64_swar_safe(block);
    store<u64>(bs.offset, block);

    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      const srcIdx = srcStart + laneIdx;
      if ((laneIdx & 1) === 0) {
        mask &= mask - 1;
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          const dstIdx = bs.offset + laneIdx;
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          const dstIdx = bs.offset + laneIdx;
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }
      mask &= mask - 1;

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 2 < srcEnd) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= mask - 1;
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<u64>(dstIdx, load<u64>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 8;
    bs.offset += 8;
  }

  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);

    if (code == BACK_SLASH || code == QUOTE || code < 32) {
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escaped);
        bs.offset += 4;
      }
      srcStart += 2;
      continue;
    }

    if (code < 0xd800 || code > 0xdfff) {
      store<u16>(bs.offset, code);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    write_u_escape(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

// --- Candidate OLD: production 8-byte stride fast-path verbatim. ---

function serialize_OLD(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  do {
    const srcEnd8Fast = srcEnd - 8;
    bs.proposeSize(srcSize + 4);

    const dstStart = bs.offset;
    let dst = dstStart + 2;

    while (srcStart < srcEnd8Fast) {
      const block = load<u64>(srcStart);
      if ((block & 0xff00_ff00_ff00_ff00) != 0) break;
      const lo = block & 0x00ff_00ff_00ff_00ff;
      const asciiMask =
        ((lo - 0x0020_0020_0020_0020) |
          ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
          ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
        (0x0080_0080_0080_0080 & ~lo);
      if (asciiMask != 0) break;
      store<u64>(dst, block);
      srcStart += 8;
      dst += 8;
    }
    if (srcStart < srcEnd8Fast) break;

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (code > 0x7f || code == BACK_SLASH || code == QUOTE || code < 32)
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  slowPath(srcStart, srcEnd);
}

// --- Candidate COMBINED: single-branch fast path. Folds the high-byte and
// ascii-escape checks into a single SWAR test, eliminating one of the two
// branches in the inner loop. Saves ~1 well-predicted branch per 8 bytes.

function serialize_COMBINED(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  do {
    const srcEnd8Fast = srcEnd - 8;
    bs.proposeSize(srcSize + 4);

    const dstStart = bs.offset;
    let dst = dstStart + 2;

    while (srcStart < srcEnd8Fast) {
      const block = load<u64>(srcStart);
      const lo = block & 0x00ff_00ff_00ff_00ff;
      const loSafe = lo | 0x0100_0100_0100_0100;
      const ascii =
        ((loSafe - 0x0020_0020_0020_0020) |
          ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
          ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
        (0x0080_0080_0080_0080 & ~lo);
      const hi = block & 0xff00_ff00_ff00_ff00;
      if ((ascii | hi) != 0) break;
      store<u64>(dst, block);
      srcStart += 8;
      dst += 8;
    }
    if (srcStart < srcEnd8Fast) break;

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (code > 0x7f || code == BACK_SLASH || code == QUOTE || code < 32)
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  slowPath(srcStart, srcEnd);
}

// --- Slow-path variant: RUN-COPY. Memcpys runs of clean bytes between
// escapes instead of speculatively storing every 8-byte block and then
// patching. Wins when escape density is sparse (long clean runs) since
// memcpy is faster per byte than per-block stores. Loses on dense escapes.

// @ts-expect-error: @inline
@inline function slowPathRunCopy(srcStart: usize, srcEnd: usize): void {
  const srcEnd8 = srcEnd - 8;
  let lastPtr = srcStart;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = detect_escapable_u64_swar_safe(block);

    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      const srcIdx = srcStart + laneIdx;
      if ((laneIdx & 1) === 0) {
        mask &= mask - 1;
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

        const runLen = <u32>(srcIdx - lastPtr);
        if (runLen != 0) {
          memory.copy(bs.offset, lastPtr, runLen);
          bs.offset += runLen;
        }

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(12);
          store<u64>(bs.offset, U00_MARKER);
          store<u32>(bs.offset, escaped, 8);
          bs.offset += 12;
        } else {
          bs.growSize(4);
          store<u32>(bs.offset, escaped);
          bs.offset += 4;
        }
        lastPtr = srcIdx + 2;
        continue;
      }
      mask &= mask - 1;

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      // Flush clean run up to and including the surrogate's pair member.
      if (code <= 0xdbff && srcIdx + 2 < srcEnd) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          // Paired - leave them in the run; just skip the partner's lane.
          mask &= mask - 1;
          continue;
        }
      }

      // Unpaired surrogate - flush clean run up to it, emit \uXXXX.
      const runLen = <u32>(srcIdx - 1 - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }
      bs.growSize(12);
      store<u32>(bs.offset, U_MARKER);
      store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
      bs.offset += 12;
      lastPtr = srcIdx + 1;
    } while (mask !== 0);

    srcStart += 8;
  }

  // Scalar tail.
  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);

    if (code == BACK_SLASH || code == QUOTE || code < 32) {
      const runLen = <u32>(srcStart - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(12);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(4);
        store<u32>(bs.offset, escaped);
        bs.offset += 4;
      }
      srcStart += 2;
      lastPtr = srcStart;
      continue;
    }

    if (code < 0xd800 || code > 0xdfff) {
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        srcStart += 4;
        continue;
      }
    }

    // Unpaired surrogate.
    const runLen = <u32>(srcStart - lastPtr);
    if (runLen != 0) {
      memory.copy(bs.offset, lastPtr, runLen);
      bs.offset += runLen;
    }
    write_u_escape(code);
    srcStart += 2;
    lastPtr = srcStart;
  }

  // Final clean run.
  if (srcEnd > lastPtr) {
    const runLen = <u32>(srcEnd - lastPtr);
    memory.copy(bs.offset, lastPtr, runLen);
    bs.offset += runLen;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serialize_RUNCOPY(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  do {
    const srcEnd8Fast = srcEnd - 8;
    bs.proposeSize(srcSize + 4);

    const dstStart = bs.offset;
    let dst = dstStart + 2;

    while (srcStart < srcEnd8Fast) {
      const block = load<u64>(srcStart);
      if ((block & 0xff00_ff00_ff00_ff00) != 0) break;
      const lo = block & 0x00ff_00ff_00ff_00ff;
      const asciiMask =
        ((lo - 0x0020_0020_0020_0020) |
          ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
          ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
        (0x0080_0080_0080_0080 & ~lo);
      if (asciiMask != 0) break;
      store<u64>(dst, block);
      srcStart += 8;
      dst += 8;
    }
    if (srcStart < srcEnd8Fast) break;

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (code > 0x7f || code == BACK_SLASH || code == QUOTE || code < 32)
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  slowPathRunCopy(srcStart, srcEnd);
}

// --- Candidate TUNED: production with three micro-tweaks rolled in:
//   1. Slow path doesn't re-call bs.proposeSize (fast path already did).
//   2. Fast-path scalar-tail check rephrased as a hot-path-first range test
//      so the predicted-not-taken branch is a single compound condition.
//   3. dstStart eliminated by writing the opening quote at the end via a
//      hoisted base pointer (saves one local variable, slightly tighter
//      register pressure in the hot loop).

// @ts-expect-error: @inline
@inline function slowPathNoPropose(srcStart: usize, srcEnd: usize): void {
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  slowPath(srcStart, srcEnd);
}

function serialize_TUNED(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  bs.proposeSize(srcSize + 4);
  const dstBase = bs.offset;
  do {
    const srcEnd8Fast = srcEnd - 8;
    let dst = dstBase + 2;

    while (srcStart < srcEnd8Fast) {
      const block = load<u64>(srcStart);
      if ((block & 0xff00_ff00_ff00_ff00) != 0) break;
      const lo = block & 0x00ff_00ff_00ff_00ff;
      const asciiMask =
        ((lo - 0x0020_0020_0020_0020) |
          ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
          ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
        (0x0080_0080_0080_0080 & ~lo);
      if (asciiMask != 0) break;
      store<u64>(dst, block);
      srcStart += 8;
      dst += 8;
    }
    if (srcStart < srcEnd8Fast) break;

    // Hot-path-first: a single compound condition that's nearly always
    // false on plain ASCII. Encourages a single fused branch.
    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (code < 32 || code > 0x7f || code == BACK_SLASH || code == QUOTE)
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstBase, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  // Note: no redundant bs.proposeSize - already called above.
  slowPathNoPropose(srcStart, srcEnd);
}

// --- Candidate NEW: 16-byte wide-scan in fast path. ---

function serialize_NEW(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  do {
    bs.proposeSize(srcSize + 4);
    const dstStart = bs.offset;
    let dst = dstStart + 2;

    // Wide-scan: validate + copy 16 bytes per iter while both halves are
    // pure printable ASCII (no high byte, no escape).
    if (srcSize >= 16) {
      const srcEnd16Fast = srcEnd - 16;
      while (srcStart < srcEnd16Fast) {
        const b0 = load<u64>(srcStart);
        const b1 = load<u64>(srcStart, 8);
        if (((b0 | b1) & 0xff00_ff00_ff00_ff00) != 0) break;
        const lo0 = b0 & 0x00ff_00ff_00ff_00ff;
        const lo1 = b1 & 0x00ff_00ff_00ff_00ff;
        const m0 =
          ((lo0 - 0x0020_0020_0020_0020) |
            ((lo0 ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
            ((lo0 ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
          (0x0080_0080_0080_0080 & ~lo0);
        const m1 =
          ((lo1 - 0x0020_0020_0020_0020) |
            ((lo1 ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
            ((lo1 ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
          (0x0080_0080_0080_0080 & ~lo1);
        if ((m0 | m1) != 0) break;
        store<u64>(dst, b0);
        store<u64>(dst, b1, 8);
        srcStart += 16;
        dst += 16;
      }
    }

    // Narrow 8-byte fallback for the trailing 0-15 bytes.
    if (srcSize >= 8) {
      const srcEnd8Fast = srcEnd - 8;
      while (srcStart < srcEnd8Fast) {
        const block = load<u64>(srcStart);
        if ((block & 0xff00_ff00_ff00_ff00) != 0) break;
        const lo = block & 0x00ff_00ff_00ff_00ff;
        const asciiMask =
          ((lo - 0x0020_0020_0020_0020) |
            ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
            ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
          (0x0080_0080_0080_0080 & ~lo);
        if (asciiMask != 0) break;
        store<u64>(dst, block);
        srcStart += 8;
        dst += 8;
      }
      if (srcStart < srcEnd8Fast) break;
    }

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (code > 0x7f || code == BACK_SLASH || code == QUOTE || code < 32)
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  slowPath(srcStart, srcEnd);
}

// --- Corpus ---

const PLAIN_BASE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[]{}|;:,.<>/? ";
// Dense escape: 4 escapes per 26 chars (~1 per 6.5 chars).
const ESCAPED_BASE = 'ab"cd\\efghi\njklm\trstuvwxyz';
// Sparse escape: 1 escape per ~100 chars. Long clean runs between escapes
// should favor the RunCopy variant.
const SPARSE_BASE =
  "the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog the quick\n";

function makePlain(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32((targetLen + PLAIN_BASE.length - 1) / PLAIN_BASE.length);
  return PLAIN_BASE.repeat(repeats).slice(0, i32(targetLen));
}

function makeEscaped(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32(
    (targetLen + ESCAPED_BASE.length - 1) / ESCAPED_BASE.length,
  );
  return ESCAPED_BASE.repeat(repeats).slice(0, i32(targetLen));
}

function makeSparse(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32(
    (targetLen + SPARSE_BASE.length - 1) / SPARSE_BASE.length,
  );
  return SPARSE_BASE.repeat(repeats).slice(0, i32(targetLen));
}

const SIZES_PLAIN: usize[] = [
  8,
  16,
  32,
  64,
  256,
  1024,
  4 * 1024,
  16 * 1024,
  64 * 1024,
  256 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
];
const LABELS_PLAIN: string[] = [
  "8b",
  "16b",
  "32b",
  "64b",
  "256b",
  "1kb",
  "4kb",
  "16kb",
  "64kb",
  "256kb",
  "1mb",
  "5mb",
];
const OPS_PLAIN: u64[] = [
  400_000_000, 300_000_000, 200_000_000, 150_000_000, 100_000_000, 30_000_000,
  9_000_000, 2_500_000, 700_000, 180_000, 25_000, 5_000,
];

const SIZES_ESCAPED: usize[] = [1024, 64 * 1024, 1024 * 1024];
const LABELS_ESCAPED: string[] = ["1kb", "64kb", "1mb"];
const OPS_ESCAPED: u64[] = [4_000_000, 100_000, 6_000];

const SIZES_SPARSE: usize[] = [1024, 64 * 1024, 1024 * 1024];
const LABELS_SPARSE: string[] = ["1kb", "64kb", "1mb"];
const OPS_SPARSE: u64[] = [10_000_000, 200_000, 12_000];

const plainCorpus = new Array<string>(SIZES_PLAIN.length);
const escapedCorpus = new Array<string>(SIZES_ESCAPED.length);
const sparseCorpus = new Array<string>(SIZES_SPARSE.length);
for (let i = 0; i < SIZES_PLAIN.length; i++)
  unchecked((plainCorpus[i] = makePlain(unchecked(SIZES_PLAIN[i]))));
for (let i = 0; i < SIZES_ESCAPED.length; i++)
  unchecked((escapedCorpus[i] = makeEscaped(unchecked(SIZES_ESCAPED[i]))));
for (let i = 0; i < SIZES_SPARSE.length; i++)
  unchecked((sparseCorpus[i] = makeSparse(unchecked(SIZES_SPARSE[i]))));

let CUR: string = "";

function bench_OLD(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serialize_OLD(CUR);
  blackbox(bs.offset);
}
function bench_NEW(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serialize_NEW(CUR);
  blackbox(bs.offset);
}
function bench_PROD(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_SWAR_Baseline(CUR);
  blackbox(bs.offset);
}
function bench_COMBINED(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serialize_COMBINED(CUR);
  blackbox(bs.offset);
}
function bench_RUNCOPY(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serialize_RUNCOPY(CUR);
  blackbox(bs.offset);
}
function bench_TUNED(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serialize_TUNED(CUR);
  blackbox(bs.offset);
}

// Equivalence check: all variants must produce byte-identical output.
function snapshot(buf: usize, len: usize): string {
  const out = __new(len, idof<string>());
  memory.copy(out, buf, len);
  return changetype<string>(out);
}

function runOnceAndSnapshot(fn: (s: string) => void, s: string): string {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  fn(s);
  return snapshot(bs.buffer, bs.offset - bs.buffer);
}

function verifyAll(corpus: Array<string>): void {
  for (let i = 0; i < corpus.length; i++) {
    const v = unchecked(corpus[i]);
    const a = runOnceAndSnapshot(serialize_OLD, v);
    const b = runOnceAndSnapshot(serialize_NEW, v);
    const c = runOnceAndSnapshot(serializeString_SWAR_Baseline, v);
    const d = runOnceAndSnapshot(serialize_COMBINED, v);
    const e = runOnceAndSnapshot(serialize_RUNCOPY, v);
    const f = runOnceAndSnapshot(serialize_TUNED, v);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe(d);
    expect(a).toBe(e);
    expect(a).toBe(f);
  }
}

verifyAll(plainCorpus);
verifyAll(escapedCorpus);
verifyAll(sparseCorpus);

for (let i = 0; i < SIZES_PLAIN.length; i++) {
  const label = unchecked(LABELS_PLAIN[i]);
  const value = unchecked(plainCorpus[i]);
  const ops = unchecked(OPS_PLAIN[i]);
  const bytes = String.UTF8.byteLength(value);
  CUR = value;

  bench("Ser SWAR PROD Plain (" + label + ")", bench_PROD, ops, bytes);
  dumpToFile("swar-string-ser-h2h-prod-plain-" + label, "serialize");

  bench("Ser SWAR TUNED Plain (" + label + ")", bench_TUNED, ops, bytes);
  dumpToFile("swar-string-ser-h2h-tuned-plain-" + label, "serialize");
}

for (let i = 0; i < SIZES_ESCAPED.length; i++) {
  const label = unchecked(LABELS_ESCAPED[i]);
  const value = unchecked(escapedCorpus[i]);
  const ops = unchecked(OPS_ESCAPED[i]);
  const bytes = String.UTF8.byteLength(value);
  CUR = value;

  bench("Ser SWAR PROD Escaped (" + label + ")", bench_PROD, ops, bytes);
  dumpToFile("swar-string-ser-h2h-prod-escaped-" + label, "serialize");

  bench("Ser SWAR TUNED Escaped (" + label + ")", bench_TUNED, ops, bytes);
  dumpToFile("swar-string-ser-h2h-tuned-escaped-" + label, "serialize");
}

for (let i = 0; i < SIZES_SPARSE.length; i++) {
  const label = unchecked(LABELS_SPARSE[i]);
  const value = unchecked(sparseCorpus[i]);
  const ops = unchecked(OPS_SPARSE[i]);
  const bytes = String.UTF8.byteLength(value);
  CUR = value;

  bench("Ser SWAR PROD Sparse (" + label + ")", bench_PROD, ops, bytes);
  dumpToFile("swar-string-ser-h2h-prod-sparse-" + label, "serialize");

  bench("Ser SWAR TUNED Sparse (" + label + ")", bench_TUNED, ops, bytes);
  dumpToFile("swar-string-ser-h2h-tuned-sparse-" + label, "serialize");
}
