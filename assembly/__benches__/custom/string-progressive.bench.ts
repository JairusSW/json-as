import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { serializeString_NAIVE } from "../../serialize/naive/string";
import { expect } from "../../__tests__/lib";
import { bench, blackbox } from "../lib/bench";

// Fresh owned results, changing input values and lengths, and eight prior
// results kept alive. GC during the single sustained frame remains timed.
@json
class TextRecord {
  id: i32 = 0;
  text: string = "";
}

const retained = new StaticArray<string>(8);
let retainedIndex = 0;
let inputIndex = 0;
let activeInputs = new StaticArray<string>(0);
let activeRecords = new StaticArray<TextRecord>(0);

function keep(output: string): void {
  unchecked((retained[retainedIndex] = output));
  retainedIndex = (retainedIndex + 1) & 7;
  blackbox(output);
}

function naiveOutput(value: string): string {
  serializeString_NAIVE(value);
  return bs.out<string>();
}

function stringifyInput(): void {
  const input = unchecked(activeInputs[inputIndex]);
  inputIndex = (inputIndex + 1) & 3;
  keep(JSON.stringify(input));
}

function stringifyRecord(): void {
  const input = unchecked(activeRecords[inputIndex]);
  inputIndex = (inputIndex + 1) & 3;
  keep(JSON.stringify(input));
}

function measure(
  name: string,
  fill: string,
  count: i32,
  special: string,
): void {
  const inputs = new StaticArray<string>(4);
  const records = new StaticArray<TextRecord>(4);
  const expected = new StaticArray<string>(4);
  for (let i = 0; i < 4; i++) {
    const text =
      "request-" +
      i.toString() +
      ":" +
      fill.repeat(count + i) +
      special +
      "tail";
    inputs[i] = text;
    expected[i] = naiveOutput(text);
    const record = new TextRecord();
    record.id = i + 1;
    record.text = text;
    records[i] = record;
    expect(JSON.stringify(text)).toBe(expected[i]);
    expect(JSON.stringify(record)).toBe(
      '{"id":' + (i + 1).toString() + ',"text":' + expected[i] + "}",
    );
  }
  // Check independence after several later stringifications and a full GC.
  const previous = new StaticArray<string>(4);
  for (let i = 0; i < 4; i++) previous[i] = JSON.stringify(inputs[i]);
  for (let i = 3; i >= 0; i--) keep(JSON.stringify(records[i]));
  __collect();
  for (let i = 0; i < 4; i++) expect(previous[i]).toBe(expected[i]);

  const ops: u64 = count < 1024 ? 100_000 : 20_000;
  activeInputs = inputs;
  activeRecords = records;
  bench(name + " string", stringifyInput, ops);
  bench(name + " object", stringifyRecord, ops);
}

measure("Short clean ASCII", "a", 128, "");
measure("Long clean ASCII", "a", 8192, "");
measure("Late quote", "a", 8192, '"');
measure("Late backslash", "a", 8192, "\\");
measure("Late newline", "a", 8192, "\n");
measure("Late lone surrogate", "a", 8192, "\ud800");
measure("Dense escapes", 'a"\n\\', 256, "");
measure("Multilingual BMP", "中文，éĀ한글！", 1024, '"');
measure("Paired surrogates", "🙂", 1024, '"');
