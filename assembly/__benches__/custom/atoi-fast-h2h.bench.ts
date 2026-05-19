// Head-to-head: new SWAR atoi/atou vs the production scalar implementations.
//
// Scenarios:
//   1. atou<u32> consume-to-end at widths 4/8/10/16 (typical JSON integer
//      sizes — i32 max is 10 digits, i64 max is 19).
//   2. atoi<i32> consume-to-end including leading minus.
//   3. atouScan<u32> / atoiScan<i32> scan-to-non-digit at the same widths,
//      mimicking the production field-parsing hot path.

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { expect } from "../../__tests__/lib";
import { atoi as atoi_OLD } from "../../util/atoi";
import { deserializeUnsignedField } from "../../deserialize/simple/unsigned";
import { deserializeIntegerField } from "../../deserialize/simple/integer";
import {
  atou as atou_NEW,
  atoi as atoi_NEW,
  atouScan,
  atoiScan,
} from "../../util/atoi-fast";

// ---------------------------------------------------------------------------
// Corpora: numeric strings of varying widths, plus terminator-trailing strings
// for the scan benches.
// ---------------------------------------------------------------------------

function buildDigits(width: i32): string {
  // Repeatable, well-known content. The "1234567890" cycle keeps no zero in
  // the leading position so even small types don't short-circuit early.
  let s = "";
  while (s.length < width) s += "1234567890";
  return s.substring(0, width);
}

const W: i32[] = [4, 8, 10, 16];
const inputs: string[] = [];
const inputsScan: string[] = []; // same digits + "," for scan termination
for (let i = 0; i < W.length; i++) {
  const v = buildDigits(unchecked(W[i]));
  inputs.push(v);
  inputsScan.push(v + ",");
}

// Signed counterparts (with leading '-').
const inputsSigned: string[] = [];
const inputsSignedScan: string[] = [];
for (let i = 0; i < W.length; i++) {
  const v = "-" + buildDigits(unchecked(W[i]) - 1);
  inputsSigned.push(v);
  inputsSignedScan.push(v + ",");
}

// ---------------------------------------------------------------------------
// Hot-pointer scratch — set per scenario before benching.
// ---------------------------------------------------------------------------

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
const SLOT = memory.data(16);

// ---------------------------------------------------------------------------
// Bench routines. blackbox-wrap the result so the call isn't dead-code
// eliminated.
// ---------------------------------------------------------------------------

function atou_OLD_u32(): void {
  blackbox(atoi_OLD<u32>(CUR_PTR, CUR_END));
}
function atou_OLD_u64(): void {
  blackbox(atoi_OLD<u64>(CUR_PTR, CUR_END));
}
function atoi_OLD_i32(): void {
  blackbox(atoi_OLD<i32>(CUR_PTR, CUR_END));
}
function atoi_OLD_i64(): void {
  blackbox(atoi_OLD<i64>(CUR_PTR, CUR_END));
}

function atou_NEW_u32(): void {
  blackbox(atou_NEW<u32>(CUR_PTR, CUR_END));
}
function atou_NEW_u64(): void {
  blackbox(atou_NEW<u64>(CUR_PTR, CUR_END));
}
function atoi_NEW_i32(): void {
  blackbox(atoi_NEW<i32>(CUR_PTR, CUR_END));
}
function atoi_NEW_i64(): void {
  blackbox(atoi_NEW<i64>(CUR_PTR, CUR_END));
}

function fieldScan_OLD_u32(): void {
  blackbox(deserializeUnsignedField<u32>(CUR_PTR, CUR_END, SLOT, 0));
}
function fieldScan_OLD_u64(): void {
  blackbox(deserializeUnsignedField<u64>(CUR_PTR, CUR_END, SLOT, 0));
}
function fieldScan_OLD_i32(): void {
  blackbox(deserializeIntegerField<i32>(CUR_PTR, CUR_END, SLOT, 0));
}
function fieldScan_OLD_i64(): void {
  blackbox(deserializeIntegerField<i64>(CUR_PTR, CUR_END, SLOT, 0));
}

function fieldScan_NEW_u32(): void {
  blackbox(atouScan<u32>(CUR_PTR, CUR_END, SLOT));
}
function fieldScan_NEW_u64(): void {
  blackbox(atouScan<u64>(CUR_PTR, CUR_END, SLOT));
}
function fieldScan_NEW_i32(): void {
  blackbox(atoiScan<i32>(CUR_PTR, CUR_END, SLOT));
}
function fieldScan_NEW_i64(): void {
  blackbox(atoiScan<i64>(CUR_PTR, CUR_END, SLOT));
}

// ---------------------------------------------------------------------------
// Correctness gate.
// ---------------------------------------------------------------------------

function verifyConsume(): void {
  for (let i = 0; i < inputs.length; i++) {
    const v = unchecked(inputs[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    expect<u64>(atou_NEW<u64>(p, e)).toBe(atoi_OLD<u64>(p, e));
    expect<u32>(atou_NEW<u32>(p, e)).toBe(atoi_OLD<u32>(p, e));
  }
  for (let i = 0; i < inputsSigned.length; i++) {
    const v = unchecked(inputsSigned[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);
    expect<i64>(atoi_NEW<i64>(p, e)).toBe(atoi_OLD<i64>(p, e));
    expect<i32>(atoi_NEW<i32>(p, e)).toBe(atoi_OLD<i32>(p, e));
  }
}

function verifyScan(): void {
  const slotOld = memory.data(16);
  const slotNew = memory.data(16);
  for (let i = 0; i < inputsScan.length; i++) {
    const v = unchecked(inputsScan[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);

    const nOld = deserializeUnsignedField<u32>(p, e, slotOld, 0);
    const nNew = atouScan<u32>(p, e, slotNew);
    expect<usize>(nNew - p).toBe(nOld - p);
    expect<u32>(load<u32>(slotNew)).toBe(load<u32>(slotOld));
  }
  for (let i = 0; i < inputsSignedScan.length; i++) {
    const v = unchecked(inputsSignedScan[i]);
    const p = changetype<usize>(v);
    const e = p + ((<usize>v.length) << 1);

    const nOld = deserializeIntegerField<i32>(p, e, slotOld, 0);
    const nNew = atoiScan<i32>(p, e, slotNew);
    expect<usize>(nNew - p).toBe(nOld - p);
    expect<i32>(load<i32>(slotNew)).toBe(load<i32>(slotOld));
  }
}

verifyConsume();
verifyScan();

// ---------------------------------------------------------------------------
// Bench loop.
// ---------------------------------------------------------------------------

const OPS: u64 = 30_000_000;

for (let i = 0; i < W.length; i++) {
  const w = unchecked(W[i]);
  const bytes = <u64>(w * 2);

  // === atou<u32> consume-to-end ===
  const u = unchecked(inputs[i]);
  CUR_PTR = changetype<usize>(u);
  CUR_END = CUR_PTR + ((<usize>u.length) << 1);

  bench("atou OLD u32 (" + w.toString() + "d)", atou_OLD_u32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atou-old-u32-" + w.toString(), "parse");

  bench("atou NEW u32 (" + w.toString() + "d)", atou_NEW_u32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atou-new-u32-" + w.toString(), "parse");

  bench("atou OLD u64 (" + w.toString() + "d)", atou_OLD_u64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atou-old-u64-" + w.toString(), "parse");

  bench("atou NEW u64 (" + w.toString() + "d)", atou_NEW_u64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atou-new-u64-" + w.toString(), "parse");

  // === atoi<i32> consume-to-end ===
  const s = unchecked(inputsSigned[i]);
  CUR_PTR = changetype<usize>(s);
  CUR_END = CUR_PTR + ((<usize>s.length) << 1);

  bench("atoi OLD i32 (" + w.toString() + "d)", atoi_OLD_i32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atoi-old-i32-" + w.toString(), "parse");

  bench("atoi NEW i32 (" + w.toString() + "d)", atoi_NEW_i32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atoi-new-i32-" + w.toString(), "parse");

  bench("atoi OLD i64 (" + w.toString() + "d)", atoi_OLD_i64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atoi-old-i64-" + w.toString(), "parse");

  bench("atoi NEW i64 (" + w.toString() + "d)", atoi_NEW_i64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-atoi-new-i64-" + w.toString(), "parse");

  // === Scan variants (with trailing ',' terminator) ===
  const uScan = unchecked(inputsScan[i]);
  CUR_PTR = changetype<usize>(uScan);
  CUR_END = CUR_PTR + ((<usize>uScan.length) << 1);

  bench("scan OLD u32 (" + w.toString() + "d)", fieldScan_OLD_u32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-old-u32-" + w.toString(), "parse");

  bench("scan NEW u32 (" + w.toString() + "d)", fieldScan_NEW_u32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-new-u32-" + w.toString(), "parse");

  bench("scan OLD u64 (" + w.toString() + "d)", fieldScan_OLD_u64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-old-u64-" + w.toString(), "parse");

  bench("scan NEW u64 (" + w.toString() + "d)", fieldScan_NEW_u64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-new-u64-" + w.toString(), "parse");

  const sScan = unchecked(inputsSignedScan[i]);
  CUR_PTR = changetype<usize>(sScan);
  CUR_END = CUR_PTR + ((<usize>sScan.length) << 1);

  bench("scan OLD i32 (" + w.toString() + "d)", fieldScan_OLD_i32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-old-i32-" + w.toString(), "parse");

  bench("scan NEW i32 (" + w.toString() + "d)", fieldScan_NEW_i32, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-new-i32-" + w.toString(), "parse");

  bench("scan OLD i64 (" + w.toString() + "d)", fieldScan_OLD_i64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-old-i64-" + w.toString(), "parse");

  bench("scan NEW i64 (" + w.toString() + "d)", fieldScan_NEW_i64, OPS, bytes);
  dumpToFile("atoi-fast-h2h-scan-new-i64-" + w.toString(), "parse");
}
