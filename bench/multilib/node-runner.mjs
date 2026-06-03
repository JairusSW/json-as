import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

globalThis.print = function print(message = "") {
  console.log(message);
};

globalThis.read = function read(path) {
  return readFileSync(path, "utf8");
};

globalThis.writeFile = function writeFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
};

const target = process.argv[2];
if (!target) {
  throw new Error("Missing compiled benchmark module path");
}

await import(resolve(target));
