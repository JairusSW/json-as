// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export function rewriteCommonEscapes(source, names) {
    const original = source.statements.find((node) => node.name?.text ===
        "serializeStringRangeReservedAt_SIMD");
    if (!original?.body)
        return;
    const body = toString(original.body);
    const insertion = "const maxGrowth";
    if (body.split(insertion).length !== 2)
        return;
    const symbol = (stem) => {
        let name = stem, suffix = 0;
        while (names.has(name))
            name = stem + "_" + ++suffix;
        names.add(name);
        return name;
    };
    const shuffle = symbol("__json_common_escape_shuffle");
    const letters = symbol("__json_common_escape_letters");
    const bytes = [];
    for (let mask = 0; mask < 256; mask++) {
        const row = [];
        for (let lane = 0; lane < 8; lane++) {
            if (mask & (1 << lane))
                row.push(128, 128);
            row.push(lane * 2, lane * 2 + 1);
        }
        while (row.length < 32)
            row.push(128);
        bytes.push(...row);
    }
    const table = SimpleParser.parseTopLevelStatement(`@lazy const ${shuffle}: usize = memory.data<u8>([${bytes.join(",")}]);`);
    const mapping = SimpleParser.parseTopLevelStatement(`@lazy const ${letters}: usize = memory.data<u8>([0,0,0,0,0,0,0,0,98,116,110,0,102,114,0,0]);`);
    const fast = `
    if ((mask & 0xaaaa) == 0) {
      const mapped = i8x16.swizzle(load<v128>(${letters}), block);
      const zero = i32x4.splat(0);
      if (!v128.any_true(v128.and(lt20, i16x8.eq(mapped, zero)))) {
        const flags = v128.or(eq22, v128.or(eq5C, lt20));
        const key = i16x8.bitmask(flags);
        const extra = <u32>popcnt(key) << 1;
        const data = v128.bitselect(mapped, block, lt20);
        const selectors = ${shuffle} + (<usize>key << 5);
        const low = load<v128>(selectors);
        const high = load<v128>(selectors, 16);
        bs.prepareGrowth(extra, extra + 32);
        bs.addSize(extra);
        const slash = i16x8.splat(92);
        store<v128>(bs.offset, v128.or(i8x16.swizzle(data, low), v128.and(i8x16.lt_s(low, zero), slash)));
        store<v128>(bs.offset + 16, v128.or(i8x16.swizzle(data, high), v128.and(i8x16.lt_s(high, zero), slash)));
        bs.offset += 16 + extra;
        srcStart += 16;
        continue;
      }
    }
  `;
    original.body = SimpleParser.parseStatement(body.replace(insertion, fast + insertion));
    class Bind extends Visitor {
        _visit(node, parent) {
            node.range = source.range;
            super._visit(node, parent);
        }
    }
    new Bind().visit([original.body, table, mapping]);
    source.statements.push(table, mapping);
}
