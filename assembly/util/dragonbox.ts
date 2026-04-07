import { DRAGONBOX_F32_CACHE, DRAGONBOX_F64_CACHE } from "./dragonbox-cache";
import { decimalCount32, itoa_buffered, utoa32_dec_core } from "util/number";

const CHAR_MINUS: u16 = 45;
const CHAR_DOT: u16 = 46;
const CHAR_0: u16 = 48;
const CHAR_E: u16 = 101;
const CHAR_PLUS: u16 = 43;

let _dbK: i32 = 0;
let _dbMulInteger32: u32 = 0;
let _dbMulInteger64: u64 = 0;
let _dbMulIsInteger: bool = false;
let _dbParity: bool = false;
let _dbRemovedExponent: i32 = 0;

@inline
function rotr32(n: u32, r: i32): u32 {
  const s = r & 31;
  return (n >>> s) | (n << ((32 - s) & 31));
}

@inline
function rotr64(n: u64, r: i32): u64 {
  const s = r & 63;
  return (n >>> s) | (n << ((64 - s) & 63));
}

@inline
function floor_log10_pow2(e: i32): i32 {
  return (e * 315653) >> 20;
}

@inline
function floor_log2_pow10(e: i32): i32 {
  return (e * 1741647) >> 19;
}

@inline
function floor_log10_pow2_minus_log10_4_over_3(e: i32): i32 {
  return (e * 631305 - 261663) >> 21;
}

@inline
function floor_log5_pow2(e: i32): i32 {
  return (e * 225799) >> 19;
}

@inline
function floor_log5_pow2_minus_log5_3(e: i32): i32 {
  return (e * 451597 - 715764) >> 20;
}

@inline
function umul128_upper64(x: u64, y: u64): u64 {
  const a = <u32>(x >>> 32);
  const b = <u32>x;
  const c = <u32>(y >>> 32);
  const d = <u32>y;
  const ac = <u64>a * c;
  const bc = <u64>b * c;
  const ad = <u64>a * d;
  const bd = <u64>b * d;
  const intermediate = (bd >>> 32) + <u32>ad + <u32>bc;
  return ac + (intermediate >>> 32) + (ad >>> 32) + (bc >>> 32);
}

@inline
function umul96_upper64(x: u32, y: u64): u64 {
  const yh = <u32>(y >>> 32);
  const yl = <u32>y;
  const xyh = <u64>x * yh;
  const xyl = <u64>x * yl;
  return xyh + (xyl >>> 32);
}

@inline
function computeMul32(u: u32, cache: u64): void {
  const r = umul96_upper64(u, cache);
  _dbMulInteger32 = <u32>(r >>> 32);
  _dbMulIsInteger = <u32>r == 0;
}

@inline
function computeMulParity32(twoF: u32, cache: u64, beta: i32): void {
  const r = <u64>twoF * cache;
  _dbParity = ((r >>> (64 - beta)) & 1) != 0;
  _dbMulIsInteger = (<u32>(r >>> (32 - beta))) == 0;
}

@inline
function computeLeftEndpointShorter32(cache: u64, beta: i32): u32 {
  return <u32>((cache - (cache >>> 25)) >>> (40 - beta));
}

@inline
function computeRightEndpointShorter32(cache: u64, beta: i32): u32 {
  return <u32>((cache + (cache >>> 24)) >>> (40 - beta));
}

@inline
function computeRoundUpShorter32(cache: u64, beta: i32): u32 {
  return (<u32>(cache >>> (39 - beta)) + 1) >>> 1;
}

@inline
function removeTrailingZeros32(significand: u32): u32 {
  let exponent = 0;
  let r = rotr32(significand * 184254097, 4);
  let b = r < 429497;
  let s: u32 = b ? 1 : 0;
  if (b) significand = r;

  r = rotr32(significand * 42949673, 2);
  b = r < 42949673;
  s = s * 2 + (b ? 1 : 0);
  if (b) significand = r;

  r = rotr32(significand * 1288490189, 1);
  b = r < 429496730;
  s = s * 2 + (b ? 1 : 0);
  if (b) significand = r;

  exponent += s;
  _dbRemovedExponent = exponent;
  return significand;
}

@inline
function divideByPow10_32_1(n: u32): u32 {
  return <u32>((<u64>n * 429496730) >>> 32);
}

@inline
function divideByPow10_32_2(n: u32): u32 {
  return <u32>((<u64>n * 1374389535) >>> 37);
}

@inline
function checkDivisibilityAndDivideByPow10_32_1(n: u32): u64 {
  const prod = <u32>(n * 6554);
  return (<u64>(prod >>> 16) << 32) | (((prod & 0xFFFF) < 6554) ? 1 : 0);
}

@inline
function computeMul64(u: u64, cacheHigh: u64, cacheLow: u64): void {
  const high = umul128_upper64(u, cacheHigh);

  const a = <u32>(u >>> 32);
  const b = <u32>u;
  const c = <u32>(cacheHigh >>> 32);
  const d = <u32>cacheHigh;
  const ac = <u64>a * c;
  const bc = <u64>b * c;
  const ad = <u64>a * d;
  const bd = <u64>b * d;
  let intermediate = (bd >>> 32) + <u32>ad + <u32>bc;
  let rHigh = ac + (intermediate >>> 32) + (ad >>> 32) + (bc >>> 32);
  let rLow = (intermediate << 32) + <u32>bd;

  const add = umul128_upper64(u, cacheLow);
  const sumLow = rLow + add;
  rHigh += sumLow < rLow ? 1 : 0;
  rLow = sumLow;

  _dbMulInteger64 = rHigh;
  _dbMulIsInteger = rLow == 0;
}

@inline
function computeMulParity64(twoF: u64, cacheHigh: u64, cacheLow: u64, beta: i32): void {
  const high = twoF * cacheHigh;

  const a = <u32>(twoF >>> 32);
  const b = <u32>twoF;
  const c = <u32>(cacheLow >>> 32);
  const d = <u32>cacheLow;
  const ac = <u64>a * c;
  const bc = <u64>b * c;
  const ad = <u64>a * d;
  const bd = <u64>b * d;
  const intermediate = (bd >>> 32) + <u32>ad + <u32>bc;
  const lowHigh = ac + (intermediate >>> 32) + (ad >>> 32) + (bc >>> 32);
  const lowLow = (intermediate << 32) + <u32>bd;

  const rHigh = high + lowHigh;
  _dbParity = ((rHigh >>> (64 - beta)) & 1) != 0;
  _dbMulIsInteger = ((((rHigh << beta) & 0xFFFFFFFFFFFFFFFF) | (lowLow >>> (64 - beta))) == 0);
}

@inline
function computeLeftEndpointShorter64(cacheHigh: u64, beta: i32): u64 {
  return (cacheHigh - (cacheHigh >>> 54)) >>> (11 - beta);
}

@inline
function computeRightEndpointShorter64(cacheHigh: u64, beta: i32): u64 {
  return (cacheHigh + (cacheHigh >>> 53)) >>> (11 - beta);
}

@inline
function computeRoundUpShorter64(cacheHigh: u64, beta: i32): u64 {
  return ((cacheHigh >>> (10 - beta)) + 1) >>> 1;
}

@inline
function removeTrailingZeros64(significand: u64): u64 {
  let exponent = 0;
  let r = rotr64(significand * 28999941890838049, 8);
  let b = r < 184467440738;
  let s: u32 = b ? 1 : 0;
  if (b) significand = r;

  r = rotr64(significand * 182622766329724561, 4);
  b = r < 1844674407370956;
  s = s * 2 + (b ? 1 : 0);
  if (b) significand = r;

  r = rotr64(significand * 10330176681277348905, 2);
  b = r < 184467440737095517;
  s = s * 2 + (b ? 1 : 0);
  if (b) significand = r;

  r = rotr64(significand * 14757395258967641293, 1);
  b = r < 1844674407370955162;
  s = s * 2 + (b ? 1 : 0);
  if (b) significand = r;

  exponent += s;
  _dbRemovedExponent = exponent;
  return significand;
}

@inline
function divideByPow10_64_1(n: u64): u64 {
  return umul128_upper64(n, 1844674407370955162);
}

@inline
function divideByPow10_64_3(n: u64): u64 {
  return umul128_upper64(n, 4722366482869645214) >>> 8;
}

@inline
function checkDivisibilityAndDivideByPow10_64_2(n: u64): u64 {
  const prod = <u32>(n * 656);
  return (<u64>(prod >>> 16) << 32) | (((prod & 0xFFFF) < 656) ? 1 : 0);
}

@inline
function genExponent(buffer: usize, k: i32): i32 {
  let negative = k < 0;
  if (negative) k = -k;
  let decimals = decimalCount32(<u32>k) + 1;
  utoa32_dec_core(buffer, <u32>k, <usize>decimals);
  store<u16>(buffer, negative ? CHAR_MINUS : CHAR_PLUS);
  return decimals;
}

function prettify(buffer: usize, length: i32, k: i32): i32 {
  const fast = prettifyFast(buffer, length, k);
  if (fast >= 0) return fast;

  if (!k) {
    const tail = buffer + (<usize>length << 1);
    store<u16>(tail, CHAR_DOT);
    store<u16>(tail, CHAR_0, 2);
    return length + 2;
  }

  const kk = length + k;
  if (length <= kk && kk <= 21) {
    for (let i = length; i < kk; ++i) store<u16>(buffer + (<usize>i << 1), CHAR_0);
    const tail = buffer + (<usize>kk << 1);
    store<u16>(tail, CHAR_DOT);
    store<u16>(tail, CHAR_0, 2);
    return kk + 2;
  } else if (kk > 0 && kk <= 21) {
    const ptr = buffer + (<usize>kk << 1);
    memory.copy(ptr + 2, ptr, <usize>(-k) << 1);
    store<u16>(buffer + (<usize>kk << 1), CHAR_DOT);
    return length + 1;
  } else if (-6 < kk && kk <= 0) {
    const offset = 2 - kk;
    memory.copy(buffer + (<usize>offset << 1), buffer, <usize>length << 1);
    store<u16>(buffer, CHAR_0);
    store<u16>(buffer, CHAR_DOT, 2);
    for (let i = 2; i < offset; ++i) store<u16>(buffer + (<usize>i << 1), CHAR_0);
    return length + offset;
  } else if (length == 1) {
    store<u16>(buffer, CHAR_E, 2);
    length = genExponent(buffer + 4, kk - 1);
    return length + 2;
  } else {
    const len = <usize>length << 1;
    memory.copy(buffer + 4, buffer + 2, len - 2);
    store<u16>(buffer, CHAR_DOT, 2);
    store<u16>(buffer + len, CHAR_E, 2);
    length += genExponent(buffer + len + 4, kk - 1);
    return length + 2;
  }
}

function prettifyFast(buffer: usize, length: i32, k: i32): i32 {
  if (k == 0) {
    const tail = buffer + (<usize>length << 1);
    store<u16>(tail, CHAR_DOT);
    store<u16>(tail, CHAR_0, 2);
    return length + 2;
  }

  const kk = length + k;
  if (length <= kk && kk <= 21) {
    for (let i = length; i < kk; ++i) {
      store<u16>(buffer + (<usize>i << 1), CHAR_0);
    }
    const tail = buffer + (<usize>kk << 1);
    store<u16>(tail, CHAR_DOT);
    store<u16>(tail, CHAR_0, 2);
    return kk + 2;
  } else if (kk > 0 && kk <= 21) {
    const ptr = buffer + (<usize>kk << 1);
    memory.copy(ptr + 2, ptr, <usize>(length - kk) << 1);
    store<u16>(buffer + (<usize>kk << 1), CHAR_DOT);
    return length + 1;
  } else if (-6 < kk && kk <= 0) {
    const offset = 2 - kk;
    memory.copy(buffer + (<usize>offset << 1), buffer, <usize>length << 1);
    store<u16>(buffer, CHAR_0);
    store<u16>(buffer, CHAR_DOT, 2);
    for (let i = 2; i < offset; ++i) {
      store<u16>(buffer + (<usize>i << 1), CHAR_0);
    }
    return length + offset;
  }

  return -1;
}

function dragonboxToDecimalF32(binarySignificand: u32, binaryExponent: i32): u32 {
  const isEven = (binarySignificand & 1) == 0;
  let twoFc = binarySignificand << 1;

  if (binaryExponent != 0) {
    binaryExponent += -150;
    if (twoFc == 0) {
      const minusK = floor_log10_pow2_minus_log10_4_over_3(binaryExponent);
      const beta = binaryExponent + floor_log2_pow10(-minusK);
      const cache = load<u64>(DRAGONBOX_F32_CACHE + (<usize>(31 - minusK) << 3));
      let xi = computeLeftEndpointShorter32(cache, beta);
      const zi = computeRightEndpointShorter32(cache, beta);
      if (!(binaryExponent >= 2 && binaryExponent <= 3)) ++xi;
      let decimalSignificand = divideByPow10_32_1(zi);
      if (decimalSignificand * 10 >= xi) {
        let decimalExponent = minusK + 1;
        decimalSignificand = removeTrailingZeros32(decimalSignificand);
        decimalExponent += _dbRemovedExponent;
        _dbK = decimalExponent;
        return decimalSignificand;
      }
      decimalSignificand = computeRoundUpShorter32(cache, beta);
      if ((decimalSignificand & 1) != 0 && binaryExponent == -35) --decimalSignificand;
      else if (decimalSignificand < xi) ++decimalSignificand;
      _dbK = minusK;
      return decimalSignificand;
    }
    twoFc |= 1 << 24;
  } else {
    binaryExponent = -149;
  }

  const minusK = floor_log10_pow2(binaryExponent) - 1;
  const cache = load<u64>(DRAGONBOX_F32_CACHE + (<usize>(31 - minusK) << 3));
  const beta = binaryExponent + floor_log2_pow10(-minusK);
  const deltai = <u32>(cache >>> (63 - beta));

  computeMul32(<u32>((twoFc | 1) << beta), cache);
  let decimalSignificand = divideByPow10_32_2(_dbMulInteger32);
  let r = _dbMulInteger32 - decimalSignificand * 100;

  if (r < deltai) {
    if ((r | (_dbMulIsInteger ? 0 : 1) | (isEven ? 1 : 0)) == 0) {
      --decimalSignificand;
      r = 100;
    } else {
      let decimalExponent = minusK + 2;
      decimalSignificand = removeTrailingZeros32(decimalSignificand);
      decimalExponent += _dbRemovedExponent;
      _dbK = decimalExponent;
      return decimalSignificand;
    }
  } else if (r == deltai) {
    computeMulParity32(twoFc - 1, cache, beta);
    if (_dbParity || (_dbMulIsInteger && isEven)) {
      let decimalExponent = minusK + 2;
      decimalSignificand = removeTrailingZeros32(decimalSignificand);
      decimalExponent += _dbRemovedExponent;
      _dbK = decimalExponent;
      return decimalSignificand;
    }
  } else if (r < deltai) {
    let decimalExponent = minusK + 2;
    decimalSignificand = removeTrailingZeros32(decimalSignificand);
    decimalExponent += _dbRemovedExponent;
    _dbK = decimalExponent;
    return decimalSignificand;
  }

  decimalSignificand *= 10;
  let dist = r - (deltai >>> 1) + 5;
  const approxYParity = ((dist ^ 5) & 1) != 0;
  let packedDiv = checkDivisibilityAndDivideByPow10_32_1(dist);
  dist = <u32>(packedDiv >>> 32);
  decimalSignificand += dist;

  if ((packedDiv & 1) != 0) {
    computeMulParity32(twoFc, cache, beta);
    if (_dbParity != approxYParity) --decimalSignificand;
    else if ((decimalSignificand & 1) != 0 && _dbMulIsInteger) --decimalSignificand;
  }

  _dbK = minusK + 1;
  return decimalSignificand;
}

function dragonboxToDecimalF64(binarySignificand: u64, binaryExponent: i32): u64 {
  const isEven = (binarySignificand & 1) == 0;
  let twoFc = binarySignificand << 1;

  if (binaryExponent != 0) {
    binaryExponent += -1075;
    if (twoFc == 0) {
      const minusK = floor_log10_pow2_minus_log10_4_over_3(binaryExponent);
      const beta = binaryExponent + floor_log2_pow10(-minusK);
      const idx = <usize>(292 - minusK) << 4;
      const cacheHigh = load<u64>(DRAGONBOX_F64_CACHE + idx);
      const cacheLow = load<u64>(DRAGONBOX_F64_CACHE + idx + 8);
      let xi = computeLeftEndpointShorter64(cacheHigh, beta);
      const zi = computeRightEndpointShorter64(cacheHigh, beta);
      if (!(binaryExponent >= 2 && binaryExponent <= 3)) ++xi;
      let decimalSignificand = divideByPow10_64_1(zi);
      if (decimalSignificand * 10 >= xi) {
        let decimalExponent = minusK + 1;
        decimalSignificand = removeTrailingZeros64(decimalSignificand);
        decimalExponent += _dbRemovedExponent;
        _dbK = decimalExponent;
        return decimalSignificand;
      }
      decimalSignificand = computeRoundUpShorter64(cacheHigh, beta);
      if ((decimalSignificand & 1) != 0 && binaryExponent == -77) --decimalSignificand;
      else if (decimalSignificand < xi) ++decimalSignificand;
      _dbK = minusK;
      return decimalSignificand;
    }
    twoFc |= (<u64>1) << 53;
  } else {
    binaryExponent = -1074;
  }

  const minusK = floor_log10_pow2(binaryExponent) - 2;
  const idx = <usize>(292 - minusK) << 4;
  const cacheHigh = load<u64>(DRAGONBOX_F64_CACHE + idx);
  const cacheLow = load<u64>(DRAGONBOX_F64_CACHE + idx + 8);
  const beta = binaryExponent + floor_log2_pow10(-minusK);
  const deltai = cacheHigh >>> (63 - beta);

  computeMul64((twoFc | 1) << beta, cacheHigh, cacheLow);
  let decimalSignificand = divideByPow10_64_3(_dbMulInteger64);
  let r = _dbMulInteger64 - decimalSignificand * 1000;

  if (r < deltai) {
    if ((r | (_dbMulIsInteger ? 0 : 1) | (isEven ? 1 : 0)) == 0) {
      --decimalSignificand;
      r = 1000;
    } else {
      let decimalExponent = minusK + 3;
      decimalSignificand = removeTrailingZeros64(decimalSignificand);
      decimalExponent += _dbRemovedExponent;
      _dbK = decimalExponent;
      return decimalSignificand;
    }
  } else if (r == deltai) {
    computeMulParity64(twoFc - 1, cacheHigh, cacheLow, beta);
    if (_dbParity || (_dbMulIsInteger && isEven)) {
      let decimalExponent = minusK + 3;
      decimalSignificand = removeTrailingZeros64(decimalSignificand);
      decimalExponent += _dbRemovedExponent;
      _dbK = decimalExponent;
      return decimalSignificand;
    }
  } else if (r < deltai) {
    let decimalExponent = minusK + 3;
    decimalSignificand = removeTrailingZeros64(decimalSignificand);
    decimalExponent += _dbRemovedExponent;
    _dbK = decimalExponent;
    return decimalSignificand;
  }

  decimalSignificand *= 10;
  let dist = r - (deltai >>> 1) + 50;
  const approxYParity = ((dist ^ 50) & 1) != 0;
  let packedDiv = checkDivisibilityAndDivideByPow10_64_2(dist);
  dist = packedDiv >>> 32;
  decimalSignificand += dist;

  if ((packedDiv & 1) != 0) {
    computeMulParity64(twoFc, cacheHigh, cacheLow, beta);
    if (_dbParity != approxYParity) --decimalSignificand;
    else if ((decimalSignificand & 1) != 0 && _dbMulIsInteger) --decimalSignificand;
  }

  _dbK = minusK + 2;
  return decimalSignificand;
}

function dragonboxCoreF32(buffer: usize, value: f32): u32 {
  let sign = 0;
  if (value < 0) {
    sign = 1;
    value = -value;
    store<u16>(buffer, CHAR_MINUS);
  }
  const digits = dragonboxToDecimalF32(reinterpret<u32>(value) & 0x7FFFFF, (reinterpret<u32>(value) >>> 23) & 0xFF);
  let len = itoa_buffered<u32>(buffer + (<usize>sign << 1), digits);
  return <u32>(prettify(buffer + (<usize>sign << 1), len, _dbK) + sign);
}

function dragonboxCoreF64(buffer: usize, value: f64): u32 {
  let sign = 0;
  if (value < 0) {
    sign = 1;
    value = -value;
    store<u16>(buffer, CHAR_MINUS);
  }
  const bits = reinterpret<u64>(value);
  const digits = dragonboxToDecimalF64(bits & 0x000FFFFFFFFFFFFF, <i32>((bits >>> 52) & 0x7FF));
  let len = itoa_buffered<u64>(buffer + (<usize>sign << 1), digits);
  return <u32>(prettify(buffer + (<usize>sign << 1), len, _dbK) + sign);
}

export function dragonbox_f32_buffered(buffer: usize, value: f32): u32 {
  if (value == 0) {
    store<u16>(buffer, CHAR_0);
    store<u16>(buffer, CHAR_DOT, 2);
    store<u16>(buffer, CHAR_0, 4);
    return 3;
  }
  if (!isFinite(value)) {
    if (isNaN(value)) {
      store<u16>(buffer, 78);
      store<u16>(buffer, 97, 2);
      store<u16>(buffer, 78, 4);
      return 3;
    }
    let sign = value < 0;
    if (sign) {
      store<u16>(buffer, CHAR_MINUS);
      buffer += 2;
    }
    store<u64>(buffer, 0x690066006E0049);
    store<u64>(buffer + 8, 0x7900740069006E);
    return 8 + (sign ? 1 : 0);
  }
  return dragonboxCoreF32(buffer, value);
}

export function dragonbox_f64_buffered(buffer: usize, value: f64): u32 {
  if (value == 0) {
    store<u16>(buffer, CHAR_0);
    store<u16>(buffer, CHAR_DOT, 2);
    store<u16>(buffer, CHAR_0, 4);
    return 3;
  }
  if (!isFinite(value)) {
    if (isNaN(value)) {
      store<u16>(buffer, 78);
      store<u16>(buffer, 97, 2);
      store<u16>(buffer, 78, 4);
      return 3;
    }
    let sign = value < 0;
    if (sign) {
      store<u16>(buffer, CHAR_MINUS);
      buffer += 2;
    }
    store<u64>(buffer, 0x690066006E0049);
    store<u64>(buffer + 8, 0x7900740069006E);
    return 8 + (sign ? 1 : 0);
  }
  return dragonboxCoreF64(buffer, value);
}

export function dragonbox_buffered<T extends number>(buffer: usize, value: T): u32 {
  if (sizeof<T>() == 4) return dragonbox_f32_buffered(buffer, <f32>value);
  return dragonbox_f64_buffered(buffer, <f64>value);
}
