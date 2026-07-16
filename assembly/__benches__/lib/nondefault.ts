/**
 * Produces a same-shape JSON fixture whose string, numeric, and boolean values
 * differ from the source while object keys and field order remain unchanged.
 * Nulls stay null because their replacement depends on the destination type.
 */
export function nonDefaultValues(src: string): string {
  let out = "";
  let segment = 0;
  let i = 0;

  while (i < src.length) {
    const code = src.charCodeAt(i);
    if (code == 34) {
      const start = i++;
      let escaped = false;
      while (i < src.length) {
        const inner = src.charCodeAt(i);
        if (escaped) {
          escaped = false;
        } else if (inner == 92) {
          escaped = true;
        } else if (inner == 34) {
          break;
        }
        i++;
      }

      let next = i + 1;
      while (next < src.length) {
        const after = src.charCodeAt(next);
        if (after != 32 && after != 9 && after != 10 && after != 13) break;
        next++;
      }
      // A quoted token followed by ':' is an object key. Prefix every other
      // quoted token so even empty/default strings miss literal specialization.
      if (next >= src.length || src.charCodeAt(next) != 58) {
        out += src.slice(segment, start + 1) + "!";
        segment = start + 1;
      }
      i++;
      continue;
    }

    if (code >= 48 && code <= 57) {
      out +=
        src.slice(segment, i) +
        String.fromCharCode(48 + ((code - 48 + 1) % 10));
      segment = ++i;
      continue;
    }

    if (code == 116 && src.startsWith("true", i)) {
      out += src.slice(segment, i) + "false";
      i += 4;
      segment = i;
      continue;
    }
    if (code == 102 && src.startsWith("false", i)) {
      out += src.slice(segment, i) + "true";
      i += 5;
      segment = i;
      continue;
    }
    i++;
  }

  return out + src.slice(segment);
}
