// Vary string values without rewriting numeric tokens or key names.
export function rotateText(text, ordinal, varyLength = false) {
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    const start = ++i;
    const positions = [];
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") {
        i += text[i + 1] === "u" ? 6 : 2;
        continue;
      }
      if (/[a-zA-Z0-9]/.test(text[i])) positions.push(i);
      i++;
    }
    let next = i + 1;
    while (/[ \n\r\t]/.test(text[next] ?? "")) next++;
    if (text[next] === ":") continue;
    for (const at of positions) {
      if (seen++ !== ordinal) continue;
      const ch = text.charCodeAt(at);
      const changed =
        ch >= 97
          ? ch === 122
            ? 97
            : ch + 1
          : ch >= 65
            ? ch === 90
              ? 65
              : ch + 1
            : ch === 57
              ? 48
              : ch + 1;
      return (
        text.slice(0, at) +
        String.fromCharCode(changed).repeat(varyLength ? ordinal + 1 : 1) +
        text.slice(at + 1)
      );
    }
    if (i < start) throw new Error("invalid string scan");
  }
  return " ".repeat(ordinal + 1) + text;
}
