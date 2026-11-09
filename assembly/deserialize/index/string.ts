// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSONMode } from "../..";
import { QUOTE } from "../../custom/chars";
import { markProductionParseError } from "../error";
import {
  deserializeString_NAIVE,
  deserializeStringField_NAIVE,
  deserializeStringFieldTrusted_NAIVE,
} from "../naive/string";
import {
  deserializeString_SIMD,
  deserializeStringField_SIMD,
  deserializeStringFieldTrusted_SIMD,
} from "../simd/string";
import {
  deserializeString_SWAR,
  deserializeStringField_SWAR,
  deserializeStringFieldTrusted_SWAR,
} from "../swar/string";
import { validateJSONStringToken } from "../../util/validateJson";

export function deserializeString(srcStart: usize, srcEnd: usize): string {
  // Whole-value decoders require quote-inclusive bounds. Reject malformed
  // ranges (missing quotes or insufficient length) safely for all backends.
  if (
    srcEnd - srcStart < 4 ||
    load<u16>(srcStart) != QUOTE ||
    load<u16>(srcEnd - 2) != QUOTE
  ) {
    markProductionParseError();
    return changetype<string>(0);
  }
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeString_SIMD(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeString_NAIVE(srcStart, srcEnd);
  } else {
    return deserializeString_SWAR(srcStart, srcEnd);
  }
}

export function deserializeStringField<T extends string | null>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let end: usize;
  if (JSON_MODE == JSONMode.SIMD) {
    end = deserializeStringField_SIMD<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    end = deserializeStringField_NAIVE<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else {
    end = deserializeStringField_SWAR<T>(srcStart, srcEnd, dstObj, dstOffset);
  }
  if (JSON_STRICT && !validateJSONStringToken(srcStart, end)) return 0;
  return end;
}

export function deserializeStringFieldTrusted(
  payloadStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let end: usize;
  if (JSON_MODE == JSONMode.SIMD) {
    end = deserializeStringFieldTrusted_SIMD(
      payloadStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  } else if (JSON_MODE == JSONMode.NAIVE) {
    end = deserializeStringFieldTrusted_NAIVE(
      payloadStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  } else {
    end = deserializeStringFieldTrusted_SWAR(
      payloadStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  }
  if (JSON_STRICT && !validateJSONStringToken(payloadStart - 2, end)) return 0;
  return end;
}
