// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { keyDispatch } from "./key-dispatch.js";
import { PropertyFlags } from "./types.js";
import { isScalarType } from "./scalars.js";
export function generateCursorParser(members, compare, completeDefaults = false, specializedFields) {
    const entries = members.map((member, id) => ({
        member,
        id,
        encoded: JSON.stringify(member.alias ?? member.name),
    }));
    const equality = (entry) => compare(entry.encoded, "keyStart", "==").join(" && ");
    const selector = (tree) => {
        if ("members" in tree) {
            return tree.members
                .map((entry) => `if (field < 0 && ${equality(entry)}) field = ${entry.id};`)
                .join("\n");
        }
        return `if (load<u16>(keyStart, ${tree.offset << 1}) < ${tree.pivot}) {\n${selector(tree.left)}\n} else {\n${selector(tree.right)}\n}`;
    };
    const byLength = new Map();
    for (const entry of entries) {
        const bytes = entry.encoded.length << 1;
        const group = byLength.get(bytes) || [];
        group.push(entry);
        byLength.set(bytes, group);
    }
    const ordered = entries
        .map((entry) => `case ${entry.id}: {
    if (keyStart + ${entry.encoded.length << 1} <= srcEnd && ${equality(entry)}) {
      field = ${entry.id}; keyEnd = keyStart + ${entry.encoded.length << 1};
    }
    break;
  }`)
        .join("\n");
    const keyed = [...byLength]
        .map(([bytes, group]) => `case ${bytes}: {\n${selector(keyDispatch(group, (entry) => entry.encoded))}\nbreak;\n}`)
        .join("\n");
    const decoded = entries
        .map((entry) => `if (field < 0 && decoded == ${JSON.stringify(entry.member.alias ?? entry.member.name)
        .replaceAll("\u2028", "\\u2028")
        .replaceAll("\u2029", "\\u2029")}) field = ${entry.id};`)
        .join("\n");
    const readField = (member, field) => {
        const read = `srcStart = JSON.__cursorRead<${member.type}>(srcStart, srcEnd, changetype<usize>(out), ${field}, depth + 1);`;
        if (!specializedFields?.has(member.name))
            return read;
        const skip = isScalarType(member.type) ? `JSON.__cursorSkipScalar<${member.type}>` : "JSON.__cursorSkipString";
        return `if (isDefined(changetype<__JSON_PLAN>(0).__json_skip_${member.name})) {
      const skipped = ${skip}(srcStart, srcEnd);
      if (skipped) srcStart = skipped;
      else { ${read} }
    } else { ${read} }`;
    };
    const values = entries
        .map(({ member, id }) => {
        const field = `offsetof<this>(${JSON.stringify(member.name)})`;
        if (member.flags.has(PropertyFlags.Lazy)) {
            return `case ${id}: {
        ${readLazy(member, field)}
        break;
      }`;
        }
        return `case ${id}: {
      ${readField(member, field)}
      break;
    }`;
    })
        .join("\n");
    const anchor = members.some((member) => member.flags.has(PropertyFlags.Lazy))
        ? "out.__SET_SRC(JSON.Util.getParseSource());"
        : "";
    const hot = entries.length <= 16
        ? "do {\n" +
            entries
                .map((entry) => {
                const { member, id } = entry;
                const field = `offsetof<this>(${JSON.stringify(member.name)})`;
                const read = member.flags.has(PropertyFlags.Lazy)
                    ? `${readLazy(member, field)}`
                    : readField(member, field);
                return `{
          const keyStart = srcStart;
          if (!(keyStart + ${(entry.encoded.length + 1) << 1} <= srcEnd && ${compare(entry.encoded + ":", "keyStart", "==").join(" && ")})) break;
          srcStart = JSON.__cursorWhitespace(keyStart + ${(entry.encoded.length + 1) << 1}, srcEnd);
          ${read}
          if (!srcStart) return 0;
          expected = ${id + 1};
          srcStart = JSON.__cursorWhitespace(srcStart, srcEnd);
          if (srcStart >= srcEnd) return 0;
          const separator = load<u16>(srcStart);
          if (separator == 125) {
            ${completeDefaults && id + 1 == entries.length ? "" : "if (isDefined(out.__FINALIZE_CURSOR)) out.__FINALIZE_CURSOR();"}
            return srcStart + 2;
          }
          if (separator != 44) return 0;
          srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
        }`;
            })
                .join("\n") +
            "\n} while (false);"
        : "";
    return `__DESERIALIZE_CURSOR<__JSON_T, __JSON_PLAN = i32>(srcStart: usize, srcEnd: usize, out: __JSON_T, depth: i32, __plan: __JSON_PLAN = changetype<__JSON_PLAN>(0)): usize {
    if (depth >= 256 || srcStart >= srcEnd || load<u16>(srcStart) != 123) return 0;
    ${anchor}
    srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
    if (srcStart < srcEnd && load<u16>(srcStart) == 125) {
      if (isDefined(out.__FINALIZE_CURSOR)) out.__FINALIZE_CURSOR();
      return srcStart + 2;
    }
    let expected = 0;
    ${completeDefaults ? "let ordered = true;" : ""}
    ${hot}
    while (srcStart < srcEnd) {
      const keyStart = srcStart;
      let keyEnd: usize = 0;
      let field = -1;
      switch (expected) { ${ordered} }
      if (!keyEnd) {
        const keyToken = JSON.__cursorScanKey(keyStart, srcEnd);
        keyEnd = <usize>(keyToken >> 1);
        if (!keyEnd) return 0;
        switch (<i32>(keyEnd - keyStart)) { ${keyed} }
        if (field < 0 && (keyToken & 1) != 0) {
          const decoded = JSON.__cursorDecodeKey(keyStart, keyEnd);
          ${decoded}
        }
        ${completeDefaults ? "if (field != expected) ordered = false;" : ""}
      }
      if (field < 0) return 0;
      srcStart = JSON.__cursorWhitespace(keyEnd, srcEnd);
      if (srcStart >= srcEnd || load<u16>(srcStart) != 58) return 0;
      srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
      switch (field) { ${values} }
      if (!srcStart) return 0;
      expected = field + 1;
      srcStart = JSON.__cursorWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) return 0;
      const separator = load<u16>(srcStart);
      if (separator == 125) {
        if (isDefined(out.__FINALIZE_CURSOR)) {
          ${completeDefaults ? `if (!ordered || expected != ${entries.length})` : ""} out.__FINALIZE_CURSOR();
        }
        return srcStart + 2;
      }
      if (separator != 44) return 0;
      srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
    }
    return 0;
  }`;
}
function readLazy(member, field) {
    const offset = member.lazyPacked
        ? field
        : `offsetof<this>(${JSON.stringify(member.name.slice(0, -3) + "_val")})`;
    const mark = member.lazyPacked
        ? `store<u32>(changetype<usize>(out), 0xffffffff, ${field} + 4);`
        : `store<u64>(changetype<usize>(out), u64.MAX_VALUE, ${field});
       if (isManaged<${member.lazyInner}>()) JSON.__linkObject(changetype<usize>(out), load<usize>(changetype<usize>(out), ${offset}), false);`;
    const eagerArray = member.lazyMaybeArray ? `JSON.__isArrayField<${member.lazyInner}>() || ` : "";
    return `if (${eagerArray}isDefined(changetype<__JSON_PLAN>(0).__json_eager_${member.lazyProperty || member.name})) {
    if (isDefined(changetype<__JSON_PLAN>(0).__json_child_${member.lazyProperty || member.name})) {
      srcStart = JSON.__cursorReadPlanned(changetype<${member.lazyInner}>(0), changetype<__JSON_PLAN>(0).__json_child_${member.lazyProperty || member.name}(), srcStart, srcEnd, changetype<usize>(out), ${offset}, depth + 1);
    } else {
      srcStart = JSON.__cursorRead<${member.lazyInner}>(srcStart, srcEnd, changetype<usize>(out), ${offset}, depth + 1);
    }
    if (!srcStart) return 0;
    ${mark}
  } else {
    const valueStart = srcStart;
    srcStart = JSON.__cursorSkipValue(srcStart, srcEnd, depth + 1);
    if (!srcStart) return 0;
    store<u64>(changetype<usize>(out), (<u64>valueStart << 32) | <u64><u32>srcStart, ${field});
  }`;
}
