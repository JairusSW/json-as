// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Shared by the AssemblyScript and JavaScript throughput harnesses.
// One growing JSON document; never a batch of independent parse calls.
export const RECORD_JSON =
  '{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":\'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?","padding":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}';
import { PAYLOAD_SIZES, PAYLOAD_LABELS } from "./payload-sizes";
export const OBJECT_SIZES = PAYLOAD_SIZES;
export const OBJECT_LABELS = PAYLOAD_LABELS;

export function makeObjectJson(targetBytes: number): string {
  const records: string[] = [];
  let bytes = '{"records":['.length + "]}".length;
  while (bytes < targetBytes) {
    records.push(RECORD_JSON);
    bytes += RECORD_JSON.length + (records.length > 1 ? 1 : 0);
  }
  return '{"records":[' + records.join(",") + "]}";
}
