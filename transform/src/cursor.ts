import { keyDispatch, type KeyDispatch } from "./key-dispatch.js";
import { PropertyFlags, type Property } from "./types.js";

type Entry = { member: Property; id: number; encoded: string };

/** A checked object state machine. Layout misses retain the current cursor and
 * destination; only the key selector changes, never the completed prefix. */
export function generateCursorParser(
  members: Property[],
  compare: (key: string, ptr: string, operator: string) => string[],
): string {
  const entries = members.map((member, id) => ({
    member,
    id,
    encoded: JSON.stringify(member.alias || member.name),
  }));
  const equality = (entry: Entry) =>
    compare(entry.encoded, "keyStart", "==").join(" && ");
  const selector = (tree: KeyDispatch<Entry>): string => {
    if ("members" in tree) {
      return tree.members
        .map(
          (entry) =>
            `if (field < 0 && ${equality(entry)}) field = ${entry.id};`,
        )
        .join("\n");
    }
    return `if (load<u16>(keyStart, ${tree.offset << 1}) < ${tree.pivot}) {\n${selector(tree.left)}\n} else {\n${selector(tree.right)}\n}`;
  };
  const byLength = new Map<number, Entry[]>();
  for (const entry of entries) {
    const bytes = entry.encoded.length << 1;
    const group = byLength.get(bytes) || [];
    group.push(entry);
    byLength.set(bytes, group);
  }
  const ordered = entries
    .map(
      (entry) => `case ${entry.id}: {
    if (keyStart + ${entry.encoded.length << 1} <= srcEnd && ${equality(entry)}) {
      field = ${entry.id}; keyEnd = keyStart + ${entry.encoded.length << 1};
    }
    break;
  }`,
    )
    .join("\n");
  const keyed = [...byLength]
    .map(
      ([bytes, group]) =>
        `case ${bytes}: {\n${selector(keyDispatch(group, (entry) => entry.encoded))}\nbreak;\n}`,
    )
    .join("\n");
  const decoded = entries
    .map(
      (entry) =>
        `if (field < 0 && decoded == ${JSON.stringify(entry.member.alias || entry.member.name)}) field = ${entry.id};`,
    )
    .join("\n");
  const values = entries
    .map(({ member, id }) => {
      const field = `offsetof<this>(${JSON.stringify(member.name)})`;
      if (member.flags.has(PropertyFlags.Lazy)) {
        return `case ${id}: {
        const valueStart = srcStart;
        srcStart = JSON.__cursorSkipValue(srcStart, srcEnd, depth + 1);
        if (!srcStart) return 0;
        store<u64>(changetype<usize>(out), (<u64>valueStart << 32) | <u64><u32>srcStart, ${field});
        break;
      }`;
      }
      return `case ${id}: {
      srcStart = JSON.__cursorRead<${member.type}>(srcStart, srcEnd, changetype<usize>(out), ${field}, depth + 1);
      break;
    }`;
    })
    .join("\n");
  const anchor = members.some((member) => member.flags.has(PropertyFlags.Lazy))
    ? "out.__SET_SRC(JSON.Util.getParseSource());"
    : "";
  return `__DESERIALIZE_CURSOR(srcStart: usize, srcEnd: usize, out: this, depth: i32): usize {
    if (depth >= 256 || srcStart >= srcEnd || load<u16>(srcStart) != 123) return 0;
    ${anchor}
    srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
    if (srcStart < srcEnd && load<u16>(srcStart) == 125) return srcStart + 2;
    let expected = 0;
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
      if (separator == 125) return srcStart + 2;
      if (separator != 44) return 0;
      srcStart = JSON.__cursorWhitespace(srcStart + 2, srcEnd);
    }
    return 0;
  }`;
}
