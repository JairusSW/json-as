// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json
class Child {
  value: f32 = 0;
  values: Array<f32> = [];
}

namespace Consumer {
  type f32 = i32;


  @json
  class Parent {
    id: i32 = 0;
    child!: Child;
  }

  export function read(data: string): i32 {
    const value = JSON.parse<Parent>(data);
    return value.id;
  }
}

export function invalid(): i32 {
  return Consumer.read('{"id":7,"child":{"value":"wrong","values":[1]}}');
}

export function valid(): i32 {
  return Consumer.read('{"id":7,"child":{"value":1.5,"values":[1.5]}}');
}
