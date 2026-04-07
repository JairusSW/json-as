import { dtoa_buffered, itoa_buffered } from "util/number";
import { deserializeFloat } from "../deserialize/index/float";
import { bench, blackbox } from "./lib/bench";
import { canadaJson } from "./throughput/canada.generated";
import { dragonbox_f32_buffered, dragonbox_f64_buffered } from "../util/dragonbox";

const SCALE_15_F64: f64 = 1_000_000_000_000_000.0;
const SCALE_15_U64: u64 = 1_000_000_000_000_000;
const SCALE_14_F64: f64 = 100_000_000_000_000.0;
const SCALE_14_U64: u64 = 100_000_000_000_000;
const SCRATCH_BASELINE = memory.data(128);
const SCRATCH_FIXED15 = memory.data(128);
const SCRATCH_FIXED14 = memory.data(128);
const SCRATCH_FIXED15_OPT = memory.data(128);
const SCRATCH_FIXED14_OPT = memory.data(128);
const SCRATCH_DRAGONBOX = memory.data(128);
const DIGIT_PAIRS = memory.data<u32>([
  0x00300030, 0x00310030, 0x00320030, 0x00330030, 0x00340030, 0x00350030, 0x00360030, 0x00370030, 0x00380030, 0x00390030,
  0x00300031, 0x00310031, 0x00320031, 0x00330031, 0x00340031, 0x00350031, 0x00360031, 0x00370031, 0x00380031, 0x00390031,
  0x00300032, 0x00310032, 0x00320032, 0x00330032, 0x00340032, 0x00350032, 0x00360032, 0x00370032, 0x00380032, 0x00390032,
  0x00300033, 0x00310033, 0x00320033, 0x00330033, 0x00340033, 0x00350033, 0x00360033, 0x00370033, 0x00380033, 0x00390033,
  0x00300034, 0x00310034, 0x00320034, 0x00330034, 0x00340034, 0x00350034, 0x00360034, 0x00370034, 0x00380034, 0x00390034,
  0x00300035, 0x00310035, 0x00320035, 0x00330035, 0x00340035, 0x00350035, 0x00360035, 0x00370035, 0x00380035, 0x00390035,
  0x00300036, 0x00310036, 0x00320036, 0x00330036, 0x00340036, 0x00350036, 0x00360036, 0x00370036, 0x00380036, 0x00390036,
  0x00300037, 0x00310037, 0x00320037, 0x00330037, 0x00340037, 0x00350037, 0x00360037, 0x00370037, 0x00380037, 0x00390037,
  0x00300038, 0x00310038, 0x00320038, 0x00330038, 0x00340038, 0x00350038, 0x00360038, 0x00370038, 0x00380038, 0x00390038,
  0x00300039, 0x00310039, 0x00320039, 0x00330039, 0x00340039, 0x00350039, 0x00360039, 0x00370039, 0x00380039, 0x00390039
]);

const values = collectCanadaValues(canadaJson);
const valuesF32 = collectCanadaValuesF32(values);

console.log("Canada dtoa corpus floats: " + values.length.toString());

let mismatchFixed15 = 0;
let mismatchFixed14 = 0;
let mismatchFixed15Opt = 0;
let mismatchFixed14Opt = 0;
let mismatchDragonbox = 0;
let dragonboxRoundtripFailures = 0;
let mismatchDragonboxF32 = 0;
let dragonboxRoundtripFailuresF32 = 0;
for (let i = 0, len = values.length; i < len; i++) {
  const value = unchecked(values[i]);
  const baselineLen = dtoa_buffered(SCRATCH_BASELINE, value);
  const dragonboxLen = dragonbox_f64_buffered(SCRATCH_DRAGONBOX, value);
  const fixed15Len = dtoa_fixed15_trim(SCRATCH_FIXED15, value);
  const fixed14Len = dtoa_fixed14_trim(SCRATCH_FIXED14, value);
  const fixed15OptLen = dtoa_fixed15_trim_opt(SCRATCH_FIXED15_OPT, value);
  const fixed14OptLen = dtoa_fixed14_trim_opt(SCRATCH_FIXED14_OPT, value);
  if (!equalUtf16(SCRATCH_BASELINE, baselineLen, SCRATCH_DRAGONBOX, dragonboxLen)) {
    mismatchDragonbox++;
  }
  if (!equalUtf16(SCRATCH_BASELINE, baselineLen, SCRATCH_FIXED15, fixed15Len)) mismatchFixed15++;
  if (!equalUtf16(SCRATCH_BASELINE, baselineLen, SCRATCH_FIXED14, fixed14Len)) mismatchFixed14++;
  if (!equalUtf16(SCRATCH_FIXED15, fixed15Len, SCRATCH_FIXED15_OPT, fixed15OptLen)) mismatchFixed15Opt++;
  if (!equalUtf16(SCRATCH_FIXED14, fixed14Len, SCRATCH_FIXED14_OPT, fixed14OptLen)) mismatchFixed14Opt++;
  if (reinterpret<u64>(deserializeFloat<f64>(SCRATCH_DRAGONBOX, SCRATCH_DRAGONBOX + (<usize>dragonboxLen << 1))) != reinterpret<u64>(value)) {
    dragonboxRoundtripFailures++;
  }
}
for (let i = 0, len = valuesF32.length; i < len; i++) {
  const value = unchecked(valuesF32[i]);
  const baselineLen = dtoa_buffered(SCRATCH_BASELINE, value);
  const dragonboxLen = dragonbox_f32_buffered(SCRATCH_DRAGONBOX, value);
  if (!equalUtf16(SCRATCH_BASELINE, baselineLen, SCRATCH_DRAGONBOX, dragonboxLen)) mismatchDragonboxF32++;
  if (reinterpret<u32>(deserializeFloat<f32>(SCRATCH_DRAGONBOX, SCRATCH_DRAGONBOX + (<usize>dragonboxLen << 1))) != reinterpret<u32>(value)) {
    dragonboxRoundtripFailuresF32++;
  }
}
console.log("dtoa dragonbox mismatches vs baseline: " + mismatchDragonbox.toString());
console.log("dtoa dragonbox roundtrip failures: " + dragonboxRoundtripFailures.toString());
console.log("dtoa dragonbox f32 mismatches vs baseline: " + mismatchDragonboxF32.toString());
console.log("dtoa dragonbox f32 roundtrip failures: " + dragonboxRoundtripFailuresF32.toString());
console.log("dtoa fixed15+trim mismatches: " + mismatchFixed15.toString());
console.log("dtoa fixed14+trim mismatches: " + mismatchFixed14.toString());
console.log("dtoa fixed15+trim-opt mismatches vs fixed15: " + mismatchFixed15Opt.toString());
console.log("dtoa fixed14+trim-opt mismatches vs fixed14: " + mismatchFixed14Opt.toString());

const bytesPerOp: u64 = <u64>(values.length << 3);
const bytesPerOpF32: u64 = <u64>(valuesF32.length << 2);

bench("dtoa buffered f64 (baseline, Canada corpus)", () => blackbox(formatAllBaseline(values)), 250, bytesPerOp);
bench("dragonbox buffered f64 (Canada corpus)", () => blackbox(formatAllDragonbox(values)), 250, bytesPerOp);
bench("dtoa buffered f32 (baseline, Canada corpus)", () => blackbox(formatAllBaselineF32(valuesF32)), 250, bytesPerOpF32);
bench("dragonbox buffered f32 (Canada corpus)", () => blackbox(formatAllDragonboxF32(valuesF32)), 250, bytesPerOpF32);
bench("dtoa fixed15+trim (Canada corpus)", () => blackbox(formatAllFixed15(values)), 250, bytesPerOp);
bench("dtoa fixed14+trim (Canada corpus)", () => blackbox(formatAllFixed14(values)), 250, bytesPerOp);
bench("dtoa fixed15+trim-opt (Canada corpus)", () => blackbox(formatAllFixed15Opt(values)), 250, bytesPerOp);
bench("dtoa fixed14+trim-opt (Canada corpus)", () => blackbox(formatAllFixed14Opt(values)), 250, bytesPerOp);

function collectCanadaValues(data: string): Array<f64> {
  const out = new Array<f64>();
  let srcStart = changetype<usize>(data);
  const srcEnd = srcStart + (data.length << 1);
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == 45 || <u32>(code - 48) <= 9) {
      const tokenStart = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const next = load<u16>(srcStart);
        if (<u32>(next - 48) <= 9 || next == 46 || next == 101 || next == 69 || next == 43 || next == 45) {
          srcStart += 2;
          continue;
        }
        break;
      }
      out.push(deserializeFloat<f64>(tokenStart, srcStart));
      continue;
    }
    srcStart += 2;
  }
  return out;
}

function collectCanadaValuesF32(src: Array<f64>): Array<f32> {
  const out = new Array<f32>(src.length);
  for (let i = 0, len = src.length; i < len; i++) {
    unchecked((out[i] = <f32>unchecked(src[i])));
  }
  return out;
}

@inline
function equalUtf16(left: usize, leftLen: u32, right: usize, rightLen: u32): bool {
  if (leftLen != rightLen) return false;
  const byteLen = <usize>leftLen << 1;
  for (let offset: usize = 0; offset < byteLen; offset += 8) {
    const leftPtr = left + offset;
    const rightPtr = right + offset;
    const rem = byteLen - offset;
    if (rem >= 8) {
      if (load<u64>(leftPtr) != load<u64>(rightPtr)) return false;
    } else if (rem >= 4) {
      if (load<u32>(leftPtr) != load<u32>(rightPtr)) return false;
    } else {
      if (load<u16>(leftPtr) != load<u16>(rightPtr)) return false;
    }
  }
  return true;
}

function formatAllBaseline(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_buffered(SCRATCH_BASELINE, unchecked(src[i]));
  }
  return total;
}

function formatAllDragonbox(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dragonbox_f64_buffered(SCRATCH_DRAGONBOX, unchecked(src[i]));
  }
  return total;
}

function formatAllBaselineF32(src: Array<f32>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_buffered(SCRATCH_BASELINE, unchecked(src[i]));
  }
  return total;
}

function formatAllDragonboxF32(src: Array<f32>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dragonbox_f32_buffered(SCRATCH_DRAGONBOX, unchecked(src[i]));
  }
  return total;
}

function formatAllFixed15(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_fixed15_trim(SCRATCH_FIXED15, unchecked(src[i]));
  }
  return total;
}

function formatAllFixed14(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_fixed14_trim(SCRATCH_FIXED14, unchecked(src[i]));
  }
  return total;
}

function formatAllFixed15Opt(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_fixed15_trim_opt(SCRATCH_FIXED15_OPT, unchecked(src[i]));
  }
  return total;
}

function formatAllFixed14Opt(src: Array<f64>): u64 {
  let total: u64 = 0;
  for (let i = 0, len = src.length; i < len; i++) {
    total += dtoa_fixed14_trim_opt(SCRATCH_FIXED14_OPT, unchecked(src[i]));
  }
  return total;
}

@inline
function dtoa_fixed15_trim(buffer: usize, value: f64): u32 {
  return dtoa_fixed_trim(buffer, value, SCALE_15_F64, SCALE_15_U64, 15);
}

@inline
function dtoa_fixed14_trim(buffer: usize, value: f64): u32 {
  return dtoa_fixed_trim(buffer, value, SCALE_14_F64, SCALE_14_U64, 14);
}

@inline
function dtoa_fixed15_trim_opt(buffer: usize, value: f64): u32 {
  return dtoa_fixed_trim_direct(buffer, value, SCALE_15_F64, SCALE_15_U64, 15);
}

@inline
function dtoa_fixed14_trim_opt(buffer: usize, value: f64): u32 {
  return dtoa_fixed_trim_direct(buffer, value, SCALE_14_F64, SCALE_14_U64, 14);
}

function dtoa_fixed_trim(buffer: usize, value: f64, scaleF64: f64, scaleU64: u64, fracDigitsMax: u32): u32 {
  if (!isFinite(value) || isNaN(value)) return dtoa_buffered(buffer, value);

  if (value == 0) {
    store<u16>(buffer, 48);
    store<u16>(buffer, 46, 2);
    store<u16>(buffer, 48, 4);
    return 3;
  }

  let sign: u32 = 0;
  if (value < 0) {
    store<u16>(buffer, 45);
    sign = 1;
    value = -value;
  }

  let whole = <u64>value;
  let frac = <u64>Math.round((value - <f64>whole) * scaleF64);
  if (frac >= scaleU64) {
    whole += 1;
    frac = 0;
  }

  const wholePtr = buffer + (<usize>sign << 1);
  const wholeLen = itoa_buffered<u64>(wholePtr, whole);
  let outLen = sign + wholeLen;

  store<u16>(buffer + ((<usize>outLen) << 1), 46);
  outLen += 1;

  if (frac == 0) {
    store<u16>(buffer + ((<usize>outLen) << 1), 48);
    return outLen + 1;
  }

  let fracDigits: u32 = fracDigitsMax;
  while (frac % 10 == 0) {
    frac /= 10;
    fracDigits--;
  }

  writePaddedFraction(buffer + ((<usize>outLen) << 1), frac, fracDigits);
  return outLen + fracDigits;
}

function dtoa_fixed_trim_direct(buffer: usize, value: f64, scaleF64: f64, scaleU64: u64, fracDigitsMax: u32): u32 {
  if (!isFinite(value) || isNaN(value)) return dtoa_buffered(buffer, value);

  if (value == 0) {
    store<u16>(buffer, 48);
    store<u16>(buffer, 46, 2);
    store<u16>(buffer, 48, 4);
    return 3;
  }

  let sign: u32 = 0;
  if (value < 0) {
    store<u16>(buffer, 45);
    sign = 1;
    value = -value;
  }

  let whole = <u64>value;
  let frac = <u64>Math.round((value - <f64>whole) * scaleF64);
  if (frac >= scaleU64) {
    whole += 1;
    frac = 0;
  }

  const wholePtr = buffer + (<usize>sign << 1);
  const wholeLen = writeWholeFast(wholePtr, whole);
  let outLen = sign + wholeLen;
  store<u16>(buffer + ((<usize>outLen) << 1), 46);
  outLen += 1;

  if (frac == 0) {
    store<u16>(buffer + ((<usize>outLen) << 1), 48);
    return outLen + 1;
  }

  let fracDigits: u32 = fracDigitsMax;
  while (frac % 10 == 0) {
    frac /= 10;
    fracDigits--;
  }

  writePaddedFraction(buffer + ((<usize>outLen) << 1), frac, fracDigits);
  return outLen + fracDigits;
}

@inline
function writeWholeFast(buffer: usize, whole: u64): u32 {
  if (whole < 10) {
    store<u16>(buffer, 48 + <u16>whole);
    return 1;
  }
  if (whole < 100) {
    store<u32>(buffer, load<u32>(DIGIT_PAIRS + (<usize>whole << 2)));
    return 2;
  }
  if (whole < 1000) {
    const hi = <u16>(whole / 100);
    store<u16>(buffer, 48 + hi);
    store<u32>(buffer + 2, load<u32>(DIGIT_PAIRS + (<usize>(whole % 100) << 2)));
    return 3;
  }
  return itoa_buffered<u64>(buffer, whole);
}

function writePaddedFraction(buffer: usize, frac: u64, width: u32): void {
  let remaining = width;
  let value = frac;

  while (remaining >= 2) {
    remaining -= 2;
    const pair = <usize>(value % 100);
    value /= 100;
    store<u32>(buffer + ((<usize>remaining) << 1), load<u32>(DIGIT_PAIRS + (pair << 2)));
  }

  if (remaining == 1) {
    store<u16>(buffer, 48 + <u16>value);
  }
}
