import { JSON } from "..";
import { expect, fuzz, FuzzSeed } from "as-test";


@inline
function sameBitsF32(left: f32, right: f32): bool {
  return reinterpret<u32>(left) == reinterpret<u32>(right);
}


@inline
function sameBitsF64(left: f64, right: f64): bool {
  return reinterpret<u64>(left) == reinterpret<u64>(right);
}

function makeFiniteBitsF32(seed: FuzzSeed): u32 {
  const bits = seed.u32();
  return (bits & 0x7f800000) == 0x7f800000 ? bits & 0x807fffff : bits;
}

function makeFiniteBitsF64(seed: FuzzSeed): u64 {
  const bits = ((<u64>seed.u32()) << 32) | (<u64>seed.u32());
  return (bits & 0x7ff0000000000000) == 0x7ff0000000000000 ? bits & 0x800fffffffffffff : bits;
}


@inline
function sameJsonFloatF32(left: f32, right: f32): bool {
  return left == 0.0 ? right == 0.0 : sameBitsF32(left, right);
}


@inline
function sameJsonFloatF64(left: f64, right: f64): bool {
  return left == 0.0 ? right == 0.0 : sameBitsF64(left, right);
}

fuzz("f32 stringify/parse roundtrips finite values", (bits: u32): bool => {
  const value = reinterpret<f32>(bits);
  const encoded = JSON.stringify<f32>(value);
  const decoded = JSON.parse<f32>(encoded);

  expect(sameJsonFloatF32(value, decoded)).toBe(true);
  expect(JSON.stringify<f32>(decoded)).toBe(encoded);

  return sameJsonFloatF32(value, decoded);
}).generate((seed: FuzzSeed, run: (bits: u32) => bool): void => {
  run(makeFiniteBitsF32(seed));
});

fuzz("f64 stringify/parse roundtrips finite values", (high: u32, low: u32): bool => {
  const bits = ((<u64>high) << 32) | (<u64>low);
  const value = reinterpret<f64>(bits);
  const encoded = JSON.stringify<f64>(value);
  const decoded = JSON.parse<f64>(encoded);

  expect(sameJsonFloatF64(value, decoded)).toBe(true);
  expect(JSON.stringify<f64>(decoded)).toBe(encoded);

  return sameJsonFloatF64(value, decoded);
}).generate((seed: FuzzSeed, run: (high: u32, low: u32) => bool): void => {
  const bits = makeFiniteBitsF64(seed);
  run(<u32>(bits >>> 32), <u32>bits);
});
