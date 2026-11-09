// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// gsoc-2018 (yyjson_benchmark): the document root is a dynamic-key map of ~1264
// id -> organization records (schema.org JSON-LD). Parsed as Map<string, Org>;
// the @-prefixed JSON-LD keys are aliased, and sponsor/author sub-objects are
// fully materialized concrete records.

@json
class Sponsor {

  @alias("@type")
  type!: string;
  name!: string;
  disambiguatingDescription!: string;
  description!: string;
  url!: string;
  logo!: string;
}


@json
class Author {

  @alias("@type")
  type!: string;
  name!: string;
}


@json
class Org {

  @alias("@context")
  context!: string;


  @alias("@type")
  type!: string;
  name!: string;
  description!: string;
  sponsor!: Sponsor;
  author!: Author;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/gsoc-2018.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/gsoc-2018.min.json");

expect(JSON.parse<Map<string, Org>>(minJson).size).toBe(1264);

const gsoc = JSON.parse<Map<string, Org>>(prettyJson);
const out = "";

bench(
  "Deserialize GSOC (pretty)",
  () => {
    blackbox(JSON.parse<Map<string, Org>>(prettyJson));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("gsoc-2018-pretty", "deserialize");

bench(
  "Deserialize GSOC (min)",
  () => {
    blackbox(JSON.parse<Map<string, Org>>(minJson));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("gsoc-2018-min", "deserialize");

bench(
  "Serialize GSOC (min)",
  () => {
    blackbox(JSON.stringify(gsoc, out));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("gsoc-2018-min", "serialize");
