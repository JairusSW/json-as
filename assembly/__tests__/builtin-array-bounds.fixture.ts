// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";

export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function rawLength(input: string): i32 {
  return JSON.parse<JSON.Raw[]>(input).length;
}
export function boxLength(input: string): i32 {
  return JSON.parse<JSON.Box<bool>[]>(input).length;
}
export function typedLength(input: string): i32 {
  return JSON.parse<Int32Array>(input).length;
}
export function floatLength(input: string): i32 {
  return JSON.parse<Float64Array>(input).length;
}
export function floatFirst(input: string): f64 {
  return JSON.parse<Float64Array>(input)[0];
}
export function bufferLength(input: string): i32 {
  return JSON.parse<ArrayBuffer>(input).byteLength;
}
export function staticBoolLength(input: string): i32 {
  return JSON.parse<StaticArray<bool>>(input).length;
}
export function staticIntLength(input: string): i32 {
  return JSON.parse<StaticArray<i32>>(input).length;
}
export function staticFloatLength(input: string): i32 {
  return JSON.parse<StaticArray<f64>>(input).length;
}
export function staticStringLength(input: string): i32 {
  return JSON.parse<StaticArray<string>>(input).length;
}
export function boolValue(input: string): i32 {
  return JSON.parse<bool>(input) ? 1 : 0;
}
export function valueType(input: string): i32 {
  return JSON.parse<JSON.Value>(input).type;
}
export function valueTypeInternal(input: string): i32 {
  const start = changetype<usize>(input);
  return JSON.__deserialize<JSON.Value>(
    start,
    start + ((<usize>input.length) << 1),
  ).type;
}
export function staticBoolLengthAt(srcStart: usize, byteLength: usize): i32 {
  return JSON.__deserialize<StaticArray<bool>>(srcStart, srcStart + byteLength)
    .length;
}
