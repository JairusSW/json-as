// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
let owner: (Base | null)[] = [];
let calls: i32 = 0;

@json({ nolazy }) class Base {
  n: i32 = 1;
  label: string = "rooted";
}

@json class Effect extends Base {
  extra: i32 = 9;

  @serializer('number') encode(self: Effect): string {
    calls++;
    owner.length = 0;
    if (ASC_RUNTIME == 2) __collect();
    const pressure = new Array<Effect>();
    for (let i = 0; i < 1024; i++) pressure.push(new Effect());
    if (ASC_RUNTIME == 2) __collect();
    assert(self.label == "value-42");
    const result = self.n.toString();
    assert(pressure[0].n == 1);
    return result;
  }
}
function makeChild(): Base {
  const value = new Effect();
  value.n = 42;
  value.label = "value-" + value.n.toString();
  return value;
}
export function verify(): string {
  calls = 0;
  owner = [null, makeChild()];
  const result = JSON.stringify(owner);
  assert(calls == 1);
  assert(owner.length == 0);
  return result;
}

export function selected(): bool {
  return isDefined(changetype<Base>(0).__SERIALIZE_STRING_FIELDS);
}

let observations: i32 = 0;
class ApplicationBase {
  __SERIALIZE_STRING_FIELDS(): i32 {
    observations++;
    return 7;
  }
}

@json({ nolazy })
class ApplicationChild extends ApplicationBase {
  text: string = "x";
}
export function collision(): string {
  observations = 0;
  const value = new ApplicationChild();
  const text = JSON.stringify<ApplicationChild[]>([value]);
  assert(observations == 0);
  const n = value.__SERIALIZE_STRING_FIELDS();
  return text + "|" + n.toString() + ":" + observations.toString();
}
