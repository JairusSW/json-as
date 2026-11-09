// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

let currentDescription: string = "";
let currentId: u32 = 0;
export function describe(description: string, routine: () => void): void {
  currentDescription = description;
  currentId = 0;
  routine();
}

export function it(description: string, routine: () => void): void {
  currentDescription = description;
  currentId = 0;
  routine();
}

export function expect<T>(left: T): Expectation {
  currentId++;
  // @ts-ignore
  if (!isDefined(left.toString))
    throw new Error(
      "Expected left to have a toString method, but it does not.",
    );
  // @ts-ignore
  return new Expectation(
    isNull(left) ? "null" : changetype<nonnull<T>>(left).toString(),
  );
}

class Expectation {
  public left: string;

  constructor(left: string) {
    this.left = left;
  }
  toBe<T>(right: T): void {
    // @ts-ignore
    if (!isDefined(right.toString))
      throw new Error(
        "Expected right to have a toString method, but it does not.",
      );
    // @ts-ignore
    if (this.left != (isNull(right) ? "null" : right.toString())) {
      console.log(
        "  " + currentDescription + "#" + currentId.toString() + "\n",
      );
      // @ts-ignore
      console.log(
        "  (expected) -> " + (isNull(right) ? "null" : right.toString()),
      );
      console.log("  (received) -> " + this.left);
      unreachable();
    }
  }
}

function isNull<T>(value: T): bool {
  return (
    (isInteger<T>() &&
      !isSigned<T>() &&
      nameof<T>() == "usize" &&
      value == 0) ||
    (isNullable<T>() && changetype<usize>(value) == <usize>0)
  );
}
