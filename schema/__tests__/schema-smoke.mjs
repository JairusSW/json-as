import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { emitAssemblyScriptSchema, inferJsonAsSchema } from "../lib/index.js";

function emit(samples, options = {}) {
  const schema = inferJsonAsSchema(samples, { rootName: "Root", ...options });
  return { schema, source: emitAssemblyScriptSchema(schema) };
}

function assertSource(samples, options, checks) {
  const result = emit(samples, options);
  for (const check of checks) assert.match(result.source, check, result.source);
  return result;
}

function assertWarning(schema, text) {
  assert.ok(schema.warnings.some((warning) => warning.message.includes(text)), `Expected warning containing '${text}'`);
}

function assertNoWarning(schema, text) {
  assert.ok(!schema.warnings.some((warning) => warning.message.includes(text)), `Unexpected warning containing '${text}'`);
}

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
}

// Basic object inference, aliases, nested classes, nullable primitive boxes, and numeric widening.
{
  const samples = [
    {
      id: 1,
      "display-name": "Ada",
      age: null,
      active: true,
      tags: ["compiler", "math"],
      profile: { score: 12.5 },
    },
    {
      id: 2147483648,
      "display-name": "Grace",
      active: false,
      tags: [],
      profile: { score: 9.25 },
    },
    {
      id: 3,
      "display-name": "Katherine",
      age: 44,
      active: true,
      tags: ["space"],
      profile: { score: 10 },
    },
  ];
  const { schema } = assertSource(samples, { rootName: "Person" }, [
    /export class Person/,
    /@alias\("display-name"\)\n {2}displayName: string = "";/,
    /id: i64 = 0;/,
    /@omitnull\(\)\n {2}age: JSON\.Box<i32> \| null = null;/,
    /active: bool = false;/,
    /tags: string\[\] = \[\];/,
    /profile: PersonProfile = new PersonProfile\(\);/,
    /score: f64 = 0;/,
  ]);
  assertNoWarning(schema, "Mixed JSON types");
}

// Number inference flags.
assertSource([{ a: 1, b: 2147483648, c: 1.5 }], { rootName: "Numbers" }, [/a: i32 = 0;/, /b: i64 = 0;/, /c: f64 = 0;/]);
assertSource([{ a: 1, b: 2 }], { rootName: "Numbers", preferI64: true }, [/a: i64 = 0;/, /b: i64 = 0;/]);
assertSource([{ a: 1, b: 2 }], { rootName: "Numbers", preferF64: true }, [/a: f64 = 0;/, /b: f64 = 0;/]);

// Nullable reference fields and missing fields.
assertSource([
  { name: "Ada", child: { name: "Byron" } },
  { name: "Grace", child: null, nickname: "Amazing Grace" },
], { rootName: "Family" }, [
  /name: string = "";/,
  /@omitnull\(\)\n {2}child: FamilyChild \| null = null;/,
  /@omitnull\(\)\n {2}nickname: string \| null = null;/,
]);

// Invalid identifiers, reserved words, numeric-leading keys, and field-name collisions.
{
  const { schema, source } = assertSource([{ "first name": "Ada", class: "A", "1st": true, "a-b": 1, a_b: 2 }], { rootName: "Keys" }, [
    /@alias\("first name"\)\n {2}firstName: string = "";/,
    /@alias\("class"\)\n {2}class_: string = "";/,
    /@alias\("1st"\)\n {2}_1st: bool = false;/,
    /@alias\("a-b"\)\n {2}aB: i32 = 0;/,
    /@alias\("a_b"\)\n {2}aB2: i32 = 0;/,
  ]);
  assertWarning(schema, "Field name collision");
  assert.ok(source.includes("aB2"));
}

// Root arrays generate an item class and a parse hint instead of a fake wrapper class.
assertSource([[{ id: 1 }, { id: 2 }]], { rootName: "Event" }, [
  /export class EventItem/,
  /id: i32 = 0;/,
  /Root JSON is an array\. Use JSON\.parse<EventItem\[\]>\(data\)\./,
]);

// Root scalar values generate parse hints.
assertSource([1], { rootName: "Scalar" }, [/Root JSON is a number\. Use JSON\.parse<i32>\(data\)\./]);
assertSource(["x"], { rootName: "Scalar" }, [/Root JSON is a string\. Use JSON\.parse<string>\(data\)\./]);

// Empty arrays remain dynamic unless later samples provide evidence.
{
  const emptyOnly = assertSource([{ values: [] }], { rootName: "EmptyArray" }, [/values: JSON\.Value\[\] = \[\];/]);
  assertWarning(emptyOnly.schema, "Empty array inferred as JSON.Value[]");
  const laterTyped = assertSource([{ values: [] }, { values: [1, 2, 3] }], { rootName: "LaterTyped" }, [/values: i32\[\] = \[\];/]);
  assertWarning(laterTyped.schema, "Empty array inferred as JSON.Value[]");
}

// Dynamic / non-schema-like data falls back to JSON.Value while keeping the generated class compilable.
{
  const samples = [
    {
      payload: { id: 1, ok: true },
      list: [1, "two", false, { deep: "object" }, null],
      variant: "string",
      matrix: [[1, 2], [3, 4]],
      maybeArray: ["a"],
    },
    {
      payload: ["not", "an", "object"],
      list: [{ another: 1 }, ["nested"], true],
      variant: 42,
      matrix: [[5.5], []],
      maybeArray: null,
    },
    {
      payload: null,
      list: [],
      variant: { now: "object" },
      matrix: [],
      maybeArray: ["b", "c"],
    },
  ];
  const { schema } = assertSource(samples, { rootName: "Dynamic" }, [
    /@omitnull\(\)\n {2}payload: JSON\.Value \| null = null;/,
    /list: JSON\.Value\[\] = \[\];/,
    /variant: JSON\.Value = JSON\.Value\.empty\(\);/,
    /matrix: f64\[\]\[\] = \[\];/,
    /@omitnull\(\)\n {2}maybeArray: string\[\] \| null = null;/,
  ]);
  assertWarning(schema, "Mixed JSON types");
}

// Arrays of objects merge optional fields across elements and samples.
assertSource([{ users: [{ id: 1, name: "Ada" }, { id: 2 }] }, { users: [{ id: 3, active: true }] }], { rootName: "Users" }, [
  /users: UsersUsersItem\[\] = \[\];/,
  /id: i32 = 0;/,
  /@omitnull\(\)\n {2}name: string \| null = null;/,
  /@omitnull\(\)\n {2}active: JSON\.Box<bool> \| null = null;/,
]);

// Identical nested shapes dedupe by default, but can be kept separate.
{
  const deduped = emit([{ left: { x: 1 }, right: { x: 2 } }], { rootName: "Pair" });
  assert.match(deduped.source, /left: PairLeft = new PairLeft\(\);/);
  assert.match(deduped.source, /right: PairLeft = new PairLeft\(\);/);
  const notDeduped = emit([{ left: { x: 1 }, right: { x: 2 } }], { rootName: "Pair", dedupe: false });
  assert.match(notDeduped.source, /left: PairLeft = new PairLeft\(\);/);
  assert.match(notDeduped.source, /right: PairRight = new PairRight\(\);/);
}

// Strict mode rejects dynamic fields instead of silently falling back to JSON.Value.
assert.throws(() => inferJsonAsSchema([{ x: 1 }, { x: "nope" }], { rootName: "Strict", strict: true }), /Mixed JSON types/);
assert.throws(() => inferJsonAsSchema([{ values: [1, "two"] }], { rootName: "Strict", strict: true }), /Mixed JSON types/);
assert.throws(() => inferJsonAsSchema([], { rootName: "Empty" }), /At least one JSON sample/);

// CLI JSONL smoke test.
{
  const dir = await mkdtemp(join(tmpdir(), "json-as-schema-"));
  const input = join(dir, "events.jsonl");
  const output = join(dir, "event.ts");
  await writeFile(input, [{ id: 1 }, { id: 2, name: "Ada" }].map((sample) => JSON.stringify(sample)).join("\n"));
  const cli = runNode(["schema/lib/cli.js", "--jsonl", "--name", "Event", "--out", output, input]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(await readFile(output, "utf8"), /export class Event/);
}

// CLI error and help paths.
assert.notEqual(runNode(["schema/lib/cli.js"]).status, 0);
assert.equal(runNode(["schema/lib/cli.js", "--help"]).status, 0);

// Generated schema should compile with the json-as transform.
{
  const compileDir = "build/schema-smoke";
  await mkdir(compileDir, { recursive: true });
  const compileInput = `${compileDir}/sample.json`;
  const compileSchema = `${compileDir}/schema.ts`;
  await writeFile(compileInput, JSON.stringify({ id: 1, "display-name": "Ada", profile: { score: 12.5 } }));
  const compileCli = runNode(["schema/lib/cli.js", "--name", "Smoke", "--out", compileSchema, compileInput]);
  assert.equal(compileCli.status, 0, compileCli.stderr);
  await writeFile(`${compileDir}/test.ts`, `import { JSON } from "../../index";
import { Smoke } from "./schema";

const parsed = JSON.parse<Smoke>("{\\"id\\":1,\\"display-name\\":\\"Ada\\",\\"profile\\":{\\"score\\":12.5}}");
assert(parsed.id == 1);
assert(parsed.displayName == "Ada");
assert(parsed.profile.score == 12.5);
`);
  const asc = runNode([
    "node_modules/assemblyscript/bin/asc.js",
    `${compileDir}/test.ts`,
    "--transform",
    "./transform",
    "--noEmit",
    "--enable",
    "simd",
    "--config",
    "./node_modules/@assemblyscript/wasi-shim/asconfig.json",
  ]);
  assert.equal(asc.status, 0, asc.stderr);
}
