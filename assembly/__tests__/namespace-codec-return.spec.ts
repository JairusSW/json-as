// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

namespace Model {

  @json export class Local {
    value: string = "local";


    @deserializer("string") decode(source: string): Local {
      const out = new Local();
      out.value = JSON.parse<string>(source);
      return out;
    }
  }


  @json export class Qualified {
    value: string = "local";


    @deserializer("string") decode(source: string): Model.Qualified {
      const out = new Qualified();
      out.value = JSON.parse<string>(source);
      return out;
    }
  }
}
describe("codec return identities resolve lexically", () => {
  expect(JSON.parse<Model.Local>('"ok"').value).toBe("ok");
  expect(JSON.parse<Model.Qualified>('"ok"').value).toBe("ok");
});
