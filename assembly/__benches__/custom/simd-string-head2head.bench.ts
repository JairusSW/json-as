import { expect } from "../../__tests__/lib";
import { deserializeStringField_SIMD, deserializeString_SIMD } from "../../deserialize/simd/string";
import { deserializeStringField_SWAR, deserializeString_SWAR } from "../../deserialize/swar/string";
import { bench, blackbox, dumpToFile } from "../lib/bench";

const plainInputs: string[] = ['"jairus Jairus Tanaka me@jairus.dev https://avatars.githubusercontent.com/u/123456?v=4 I like compilers elegant algorithms bare metal simd wasm https://jairus.dev/ Seattle WA 2020-01-15T08:30:00Z dark en-US America/Los_Angeles friends_only typescript webassembly performance assemblyscript json starred 2025-12-22T10:15:00Z assemblyscript/json-as commented issue #142 pushed main branch forked fast-json-wasm created new benchmark suite repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated repeated"'];

const escapedInputs: string[] = ['"ab\\\\\\"cd line\\nfeed tab\\tindent quote: \\"hello\\" slash\\\\backslash unicode \\u263A face emoji \\uD83D\\uDE80 mix\\\\\\"\\n\\t\\u0041 repeated\\\\\\"chunk\\n\\t\\u0042 repeated\\\\\\"chunk\\n\\t\\u0043 repeated\\\\\\"chunk\\n\\t\\u0044 repeated\\\\\\"chunk\\n\\t\\u0045"'];

const LARGE_TARGET_BYTES: usize = 5 * 1024 * 1024;
const LARGE_PLAIN_BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[]{}|;:,.<>/? ";
const LARGE_ESCAPED_BASE = "ab\\\\ncd\\\\tEFG\\\\u0041HIJ\\\\u263A\\\\\\\\KLM";

function makePlainJsonString(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = targetLen / LARGE_PLAIN_BASE.length;
  const payload = LARGE_PLAIN_BASE.repeat(repeats);
  return `"${payload}"`;
}

function makeEscapedJsonString(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = targetLen / LARGE_ESCAPED_BASE.length;
  const payload = LARGE_ESCAPED_BASE.repeat(repeats);
  return `"${payload}"`;
}

const largePlainInputs: string[] = [makePlainJsonString(LARGE_TARGET_BYTES)];
const largeEscapedInputs: string[] = [makeEscapedJsonString(LARGE_TARGET_BYTES)];
const largePlainLen = unchecked(largePlainInputs[0]).length;
const largeEscapedLen = unchecked(largeEscapedInputs[0]).length;
if (largePlainLen < i32(LARGE_TARGET_BYTES >> 1) - LARGE_PLAIN_BASE.length) abort("Large plain payload too small");
if (largeEscapedLen < i32(LARGE_TARGET_BYTES >> 1) - LARGE_ESCAPED_BASE.length) abort("Large escaped payload too small");

function totalBytesOf(values: string[]): u64 {
  let total: u64 = 0;
  for (let i = 0; i < values.length; i++) total += <u64>(unchecked(values[i]).length << 1);
  return total;
}

const VARIANT_SIMD_FIELD: i32 = 0;
const VARIANT_SWAR_FIELD: i32 = 1;

function runFieldCorpus(values: string[], out: Array<string>, variant: i32): void {
  for (let i = 0; i < values.length; i++) {
    const value = unchecked(values[i]);
    const ptr = changetype<usize>(value);
    const end = ptr + (value.length << 1);
    const slot = out.dataStart + ((<usize>i) << alignof<string>());
    if (variant == VARIANT_SWAR_FIELD) {
      blackbox(deserializeStringField_SWAR<string>(ptr, end, slot));
    } else {
      blackbox(deserializeStringField_SIMD<string>(ptr, end, slot));
    }
  }
  blackbox(out);
}

const plainSIMD = new Array<string>(plainInputs.length);
const plainSWAR = new Array<string>(plainInputs.length);
const escapedSIMD = new Array<string>(escapedInputs.length);
const escapedSWAR = new Array<string>(escapedInputs.length);
const largePlainSIMD = new Array<string>(largePlainInputs.length);
const largePlainSWAR = new Array<string>(largePlainInputs.length);
const largeEscapedSIMD = new Array<string>(largeEscapedInputs.length);
const largeEscapedSWAR = new Array<string>(largeEscapedInputs.length);

runFieldCorpus(plainInputs, plainSIMD, VARIANT_SIMD_FIELD);
runFieldCorpus(plainInputs, plainSWAR, VARIANT_SWAR_FIELD);
runFieldCorpus(escapedInputs, escapedSIMD, VARIANT_SIMD_FIELD);
runFieldCorpus(escapedInputs, escapedSWAR, VARIANT_SWAR_FIELD);
runFieldCorpus(largePlainInputs, largePlainSIMD, VARIANT_SIMD_FIELD);
runFieldCorpus(largePlainInputs, largePlainSWAR, VARIANT_SWAR_FIELD);
runFieldCorpus(largeEscapedInputs, largeEscapedSIMD, VARIANT_SIMD_FIELD);
runFieldCorpus(largeEscapedInputs, largeEscapedSWAR, VARIANT_SWAR_FIELD);

const plainDirectSIMD = deserializeString_SIMD(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1));
const escapedDirectSIMD = deserializeString_SIMD(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1));
const plainDirectSWAR = deserializeString_SWAR(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1));
const escapedDirectSWAR = deserializeString_SWAR(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1));

for (let i = 0; i < plainInputs.length; i++) {
  expect(unchecked(plainSIMD[i])).toBe(unchecked(plainSWAR[i]));
}
for (let i = 0; i < escapedInputs.length; i++) {
  expect(unchecked(escapedSIMD[i])).toBe(unchecked(escapedSWAR[i]));
}
for (let i = 0; i < largePlainInputs.length; i++) {
  expect(unchecked(largePlainSIMD[i])).toBe(unchecked(largePlainSWAR[i]));
}
for (let i = 0; i < largeEscapedInputs.length; i++) {
  expect(unchecked(largeEscapedSIMD[i])).toBe(unchecked(largeEscapedSWAR[i]));
}
expect(plainDirectSIMD).toBe(unchecked(plainSWAR[0]));
expect(escapedDirectSIMD).toBe(unchecked(escapedSWAR[0]));
expect(plainDirectSWAR).toBe(unchecked(plainSWAR[0]));
expect(escapedDirectSWAR).toBe(unchecked(escapedSWAR[0]));

const plainBytes = totalBytesOf(plainInputs);
const escapedBytes = totalBytesOf(escapedInputs);
const largePlainBytes = totalBytesOf(largePlainInputs);
const largeEscapedBytes = totalBytesOf(largeEscapedInputs);

function benchFieldPlainSIMD(): void {
  runFieldCorpus(plainInputs, plainSIMD, VARIANT_SIMD_FIELD);
}
function benchFieldPlainSWAR(): void {
  runFieldCorpus(plainInputs, plainSWAR, VARIANT_SWAR_FIELD);
}
function benchFieldEscapedSIMD(): void {
  runFieldCorpus(escapedInputs, escapedSIMD, VARIANT_SIMD_FIELD);
}
function benchFieldEscapedSWAR(): void {
  runFieldCorpus(escapedInputs, escapedSWAR, VARIANT_SWAR_FIELD);
}
function benchDirectPlainSIMD(): void {
  blackbox(deserializeString_SIMD(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1)));
}
function benchDirectPlainSWAR(): void {
  blackbox(deserializeString_SWAR(changetype<usize>(unchecked(plainInputs[0])), changetype<usize>(unchecked(plainInputs[0])) + (unchecked(plainInputs[0]).length << 1)));
}
function benchDirectEscapedSIMD(): void {
  blackbox(deserializeString_SIMD(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1)));
}
function benchDirectEscapedSWAR(): void {
  blackbox(deserializeString_SWAR(changetype<usize>(unchecked(escapedInputs[0])), changetype<usize>(unchecked(escapedInputs[0])) + (unchecked(escapedInputs[0]).length << 1)));
}
function benchLargeFieldPlainSIMD(): void {
  runFieldCorpus(largePlainInputs, largePlainSIMD, VARIANT_SIMD_FIELD);
}
function benchLargeFieldPlainSWAR(): void {
  runFieldCorpus(largePlainInputs, largePlainSWAR, VARIANT_SWAR_FIELD);
}
function benchLargeFieldEscapedSIMD(): void {
  runFieldCorpus(largeEscapedInputs, largeEscapedSIMD, VARIANT_SIMD_FIELD);
}
function benchLargeFieldEscapedSWAR(): void {
  runFieldCorpus(largeEscapedInputs, largeEscapedSWAR, VARIANT_SWAR_FIELD);
}

bench("SIMD String Head-to-Head Field Plain", benchFieldPlainSIMD, 1_000_000, plainBytes);
dumpToFile("simd-string-head2head-field-plain", "deserialize");

bench("SIMD String Head-to-Head Field Plain (SWAR)", benchFieldPlainSWAR, 1_000_000, plainBytes);
dumpToFile("simd-string-head2head-field-plain-swar", "deserialize");

bench("SIMD String Head-to-Head Direct Plain", benchDirectPlainSIMD, 1_000_000, plainBytes);
dumpToFile("simd-string-head2head-direct-plain", "deserialize");

bench("SIMD String Head-to-Head Direct Plain (SWAR)", benchDirectPlainSWAR, 1_000_000, plainBytes);
dumpToFile("simd-string-head2head-direct-plain-swar", "deserialize");

bench("SIMD String Head-to-Head Field Escaped", benchFieldEscapedSIMD, 1_000_000, escapedBytes);
dumpToFile("simd-string-head2head-field-escaped", "deserialize");

bench("SIMD String Head-to-Head Field Escaped (SWAR)", benchFieldEscapedSWAR, 1_000_000, escapedBytes);
dumpToFile("simd-string-head2head-field-escaped-swar", "deserialize");

bench("SIMD String Head-to-Head Direct Escaped", benchDirectEscapedSIMD, 1_000_000, escapedBytes);
dumpToFile("simd-string-head2head-direct-escaped", "deserialize");

bench("SIMD String Head-to-Head Direct Escaped (SWAR)", benchDirectEscapedSWAR, 1_000_000, escapedBytes);
dumpToFile("simd-string-head2head-direct-escaped-swar", "deserialize");

bench("SIMD String Head-to-Head Field Plain (5mb)", benchLargeFieldPlainSIMD, 500, largePlainBytes);
dumpToFile("simd-string-head2head-field-plain-5mb", "deserialize");

bench("SIMD String Head-to-Head Field Plain (5mb) (SWAR)", benchLargeFieldPlainSWAR, 500, largePlainBytes);
dumpToFile("simd-string-head2head-field-plain-5mb-swar", "deserialize");

bench("SIMD String Head-to-Head Field Escaped (5mb)", benchLargeFieldEscapedSIMD, 500, largeEscapedBytes);
dumpToFile("simd-string-head2head-field-escaped-5mb", "deserialize");

bench("SIMD String Head-to-Head Field Escaped (5mb) (SWAR)", benchLargeFieldEscapedSWAR, 500, largeEscapedBytes);
dumpToFile("simd-string-head2head-field-escaped-5mb-swar", "deserialize");
