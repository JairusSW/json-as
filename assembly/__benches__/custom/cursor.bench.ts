import { JSON } from "../..";
import { validateCursor } from "../../deserialize/cursor";
import { validateJSON } from "../../util/validateJson";
import { expect } from "../../__tests__/lib";
import { bench, blackbox } from "../lib/bench";

// JSON_STRICT=true npm run bench:as -- custom/cursor --mode swar
// Inputs are prebuilt, rotate on every operation, and never match schema defaults.
// Validation-only and owned/reused parsing perform deliberately different work.
@json
class CursorBenchChild {
  value: f64 = 0;
  text: string = "";
}


@json
class CursorBenchRecord {
  id: i32 = 0;
  name: string = "";
  child: CursorBenchChild | null = null;
  samples: f64[] = [];
  payload: JSON.Raw = JSON.Raw.from("null");
  active: bool = false;
}

if (!JSON_STRICT) throw new Error("cursor benchmark requires JSON_STRICT=true");

const canonical: string[] = [];
const reordered: string[] = [];
const lateMiss: string[] = [];
for (let i = 0; i < 4; i++) {
  const id = (i + 1).toString();
  const fields: string[] = [
    '"id":' + id,
    '"name":"request-' + id + '-中"',
    '"child":{"value":' + id + '.25,"text":"worker-' + id + '"}',
    '"samples":[1.25,2.5,3.75]',
    '"payload":{"nested":[{"score":' +
      id +
      '.25,"text":"line\\n' +
      id +
      '"}],"enabled":true}',
    '"active":' + (i & 1 ? "true" : "false"),
  ];
  canonical.push("{" + fields.join(",") + "}");
  lateMiss.push(
    "{" +
      fields.slice(0, 4).join(",") +
      "," +
      fields[5] +
      "," +
      fields[4] +
      "}",
  );
  reordered.push("{" + fields.reverse().join(",") + "}");
  expect(validateJSON(canonical[i])).toBe(true);
  expect(validateCursor(canonical[i])).toBe(true);
  expect(JSON.stringify(JSON.parse<CursorBenchRecord>(reordered[i]))).toBe(
    canonical[i],
  );
  expect(JSON.stringify(JSON.parse<CursorBenchRecord>(lateMiss[i]))).toBe(
    canonical[i],
  );
}

let index: i32 = 0;
const reuse = new CursorBenchRecord();
const N: u64 = 500_000;
const inputBytes = String.UTF8.byteLength(canonical[0]);

function next(inputs: string[]): string {
  const value = unchecked(inputs[index]);
  index = (index + 1) & 3;
  return value;
}
function referenceValidation(): void {
  blackbox(validateJSON(next(canonical)));
}
function cursorValidation(): void {
  blackbox(validateCursor(next(canonical)));
}
function freshCanonical(): void {
  blackbox(JSON.parse<CursorBenchRecord>(next(canonical)));
}
function freshReordered(): void {
  blackbox(JSON.parse<CursorBenchRecord>(next(reordered)));
}
function freshLateMiss(): void {
  blackbox(JSON.parse<CursorBenchRecord>(next(lateMiss)));
}
function reusedOutput(): void {
  blackbox(JSON.parse<CursorBenchRecord>(next(canonical), reuse));
}

bench("Reference validation (rotating)", referenceValidation, N, inputBytes);
bench("Cursor validation (rotating)", cursorValidation, N, inputBytes);
bench("Strict owned parse canonical (rotating)", freshCanonical, N, inputBytes);
bench("Strict owned parse reordered (rotating)", freshReordered, N, inputBytes);
bench(
  "Strict owned parse late layout miss (rotating)",
  freshLateMiss,
  N,
  inputBytes,
);
bench("Strict reused parse canonical (rotating)", reusedOutput, N, inputBytes);
