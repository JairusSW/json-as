// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const notice = [
  "This Source Code Form is subject to the terms of the Mozilla Public",
  "License, v. 2.0. If a copy of the MPL was not distributed with this",
  "file, You can obtain one at https://mozilla.org/MPL/2.0/.",
  "",
  "SPDX-License-Identifier: MPL-2.0",
  "Copyright (c) 2026 Jairus Tanaka",
];
export const thirdParty = new Map([
  ["tools/assemblyscript-eslint.js", "Apache-2.0"],
  ["tools/assemblyscript-eslint-local.js", "Apache-2.0"],
]);

export function styleFor(file) {
  if (
    /\.(py|sh|bash)$/.test(file) ||
    /^\.husky\//.test(file) ||
    /^\.github\/workflows\/.*\.ya?ml$/.test(file)
  )
    return "#";
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|go|c|h|cpp|hpp|rs)$/.test(file) ||
    /\.ts\.disable(d)?$/.test(file)
  )
    return "//";
  return null;
}

export function renderNotice(style) {
  if (!["#", "//"].includes(style))
    throw Error("Unsupported source comment style");
  return (
    notice.map((line) => (line ? style + " " + line : style)).join("\n") + "\n"
  );
}

function splitPreamble(text, style) {
  let prefix = "";
  if (text.startsWith("\uFEFF")) {
    prefix = "\uFEFF";
    text = text.slice(1);
  }
  if (text.startsWith("#!")) {
    const end = text.indexOf("\n");
    prefix += end < 0 ? text + "\n" : text.slice(0, end + 1);
    text = end < 0 ? "" : text.slice(end + 1);
  }
  if (style === "#" && /^#.*coding[:=]/.test(text)) {
    const end = text.indexOf("\n");
    prefix += end < 0 ? text + "\n" : text.slice(0, end + 1);
    text = end < 0 ? "" : text.slice(end + 1);
  }
  return { prefix, body: text };
}

export function addNotice(text, style) {
  const { prefix, body } = splitPreamble(text, style);
  const header = renderNotice(style);
  if (body.startsWith(header)) return text;
  const existing = body
    .slice(0, 4096)
    .match(
      /^[ \t]*(?:(?:\/\/|\/\*|\*|#)[ \t]*)?SPDX-License-Identifier:[ \t]*([^\r\n]+)/m,
    );
  if (existing)
    throw Error(
      "Refusing to replace an existing or misplaced license notice: " +
        existing[1],
    );
  return prefix + header + (body ? "\n" + body : "");
}

export function processFiles(root, files, write = false) {
  const missing = [];
  let checked = 0,
    preserved = 0;
  for (const file of files) {
    const style = styleFor(file);
    if (!style || !fs.existsSync(path.join(root, file))) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (thirdParty.has(file)) {
      const license = thirdParty.get(file);
      if (
        !source.includes("SPDX-License-Identifier: " + license) ||
        !source.includes("Hypermode")
      ) {
        throw Error("Missing third-party attribution: " + file);
      }
      preserved++;
      continue;
    }
    const result = addNotice(source, style);
    if (source !== result) missing.push(file);
    if (write && source !== result)
      fs.writeFileSync(path.join(root, file), result);
    checked++;
  }
  return { checked, preserved, missing };
}

export function trackedFiles(root) {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const flag = process.argv[2] ?? "--check";
  if (!["--check", "--write", "--generated"].includes(flag))
    throw Error("Use --check, --write or --generated");
  const files =
    flag === "--generated"
      ? fs
          .readdirSync(path.join(root, "transform/lib"), { recursive: true })
          .filter((file) => /\.(js|ts)$/.test(file))
          .map((file) => "transform/lib/" + file)
      : trackedFiles(root);
  const result = processFiles(root, files, flag !== "--check");
  console.log(
    "License headers: " +
      result.checked +
      " project files; " +
      result.preserved +
      " preserved third-party files.",
  );
  if (flag === "--check" && result.missing.length) {
    console.error("Missing MPL-2.0 notices:\n" + result.missing.join("\n"));
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
