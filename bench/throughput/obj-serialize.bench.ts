import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT_SIZES, OBJECT_LABELS, makeObjectJson } from "./object-workload";

let input = "";
let value: unknown;

function operation(): void {
  blackbox(JSON.stringify(value));
}

for (let i = 0; i < OBJECT_SIZES.length; i++) {
  input = makeObjectJson(OBJECT_SIZES[i]);
  // Fixture is ASCII, so its code-unit and UTF-8 byte lengths agree.
  const bytes = input.length;
  const operations = Math.min(
    200000,
    Math.max(5, Math.floor((500 * 1024 * 1024) / bytes)),
  );
  const label = OBJECT_LABELS[i];
  value = JSON.parse(input);
  if (JSON.stringify(value) !== input)
    throw new Error("Growing-object fixture mismatch");
  bench("Serialize Object (" + label + ")", operation, operations, bytes);
  dumpToFile("obj-" + label, "serialize");
}
