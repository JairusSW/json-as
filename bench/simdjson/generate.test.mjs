import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import {
  schemaFromSource,
  cppType,
  nativeSchema,
  coordinatePayloads,
  stringPayloads,
  readSchema,
} from "./generate.mjs";
const schema = (source) => schemaFromSource(source, "fixture.ts");
function checkFixtureType(value, type, classes, location = "$") {
  type = type.replaceAll(/\s/g, "");
  if (type.endsWith("|null")) {
    if (value === null) return;
    type = type.slice(0, -5);
  }
  assert.notEqual(value, null, `${location}: null for ${type}`);
  const array = /^(?:Array|StaticArray)<(.*)>$/.exec(type);
  if (array) type = `${array[1]}[]`;
  if (type.endsWith("[]")) {
    assert.ok(Array.isArray(value), `${location}: expected ${type}`);
    value.forEach((v, i) =>
      checkFixtureType(v, type.slice(0, -2), classes, `${location}[${i}]`),
    );
  } else if (type.startsWith("Map<string,")) {
    assert.equal(typeof value, "object", `${location}: expected ${type}`);
    assert.ok(!Array.isArray(value), `${location}: expected map`);
    for (const [key, child] of Object.entries(value))
      checkFixtureType(
        child,
        type.slice(11, -1),
        classes,
        `${location}.${key}`,
      );
  } else if (type.startsWith("JSON.Box<")) {
    checkFixtureType(value, type.slice(9, -1), classes, location);
  } else if (classes.has(type)) {
    assert.equal(typeof value, "object", `${location}: expected ${type}`);
    assert.ok(!Array.isArray(value), `${location}: expected record`);
    const fields = new Map(classes.get(type).fields.map((f) => [f.key, f]));
    for (const [key, child] of Object.entries(value)) {
      assert.ok(fields.has(key), `${location}: unknown ${type}.${key}`);
      checkFixtureType(
        child,
        fields.get(key).type,
        classes,
        `${location}.${key}`,
      );
    }
  } else {
    assert.match(type, /^(string|bool|boolean|[iuf](8|16|32|64))$/);
    const expected =
      type === "string"
        ? "string"
        : ["bool", "boolean"].includes(type)
          ? "boolean"
          : "number";
    assert.equal(typeof value, expected, `${location}: expected ${type}`);
    if (/^[iu]/.test(type))
      assert.ok(Number.isInteger(value), `${location}: expected integer`);
  }
}
test("fully typed classic models cover every provided field and value type", () => {
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(
    fs.readFileSync(new URL("bench/simdjson/workloads.json", root), "utf8"),
  );
  for (const corpus of manifest.corpora.filter((c) => !c.raw)) {
    const model = readSchema(new URL(corpus.source, root));
    const input = JSON.parse(
      fs.readFileSync(
        new URL(`assembly/__benches__/payloads/${corpus.name}.min.json`, root),
        "utf8",
      ),
    );
    checkFixtureType(
      input,
      corpus.root,
      new Map(model.map((c) => [c.name, c])),
      corpus.name,
    );
  }
});
test("classic raw classifications match the actual root and field types", () => {
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(
    fs.readFileSync(new URL("bench/simdjson/workloads.json", root), "utf8"),
  );
  for (const corpus of manifest.corpora) {
    const model = readSchema(new URL(corpus.source, root));
    const raw = [
      corpus.root,
      ...model.flatMap((c) => c.fields.map((f) => f.type)),
    ].some((type) => /\bJSON\.Raw\b/.test(type));
    assert.equal(corpus.raw, raw, corpus.name);
  }
});
test("retains alias, integer width, nested array and nullable ownership", () => {
  const model = schema(
    '@json class Item { @alias("item-id") id:i64; child:Item|null; coords:f64[][]; }',
  );
  const cpp = nativeSchema(model, "Item[]");
  assert.match(cpp, /rename<"item-id">/);
  assert.match(cpp, /int64_t id/);
  assert.match(cpp, /std::unique_ptr<Item> child/);
  assert.match(cpp, /std::vector<std::vector<double>> coords/);
  assert.match(cpp, /using Root=std::vector<Item>/);
  assert.match(cpp, /deny_unknown_fields/);
  assert.match(cpp, /default_value/);
  assert.doesNotMatch(cpp, /bound_detail|is_bounded/);
  assert.match(cpp, /simdjson::with<ItemNullableWriter>/);
  assert.match(cpp, /\[\[gnu::noinline\]\] static void serialize/);
  assert.match(cpp, /simdjson::builder::append\(b,\*value\)/);
  assert.match(cpp, /tag_invoke\(simdjson::deserialize_tag/);
  assert.match(cpp, /input.is_null\(\).get\(is_null\)/);
  assert.match(cpp, /if\(is_null\) \{ out.reset\(\)/);
});
test("nested map and boxed values keep their concrete type", () => {
  assert.equal(
    cppType("Map<string,Array<JSON.Box<u64>>>", new Set()),
    "std::map<std::string,std::vector<uint64_t>>",
  );
});
test("optional fields retain missing-key defaults and remain serialized", () => {
  const model = schema(
    '@json class Item { @optional @alias("child-name") child:string|null; n:i32; }',
  );
  assert.equal(model[0].fields[0].optional, true);
  assert.equal(model[0].fields[1].optional, false);
  const cpp = nativeSchema(model, "Item");
  assert.match(cpp, /default_value/);
  assert.match(cpp, /rename<"child-name">.*std::optional<std::string> child/);
  assert.doesNotMatch(cpp, /skip_serializing/);
});
test("raw values use owned text and require full native validation", () => {
  const cpp = nativeSchema(
    schema("@json class Item { raw:JSON.Raw|null; other:JSON.Raw[]; }"),
    "Item",
  );
  assert.match(cpp, /requires_raw_validation=true/);
  assert.match(cpp, /std::string data/);
  assert.match(cpp, /out.data.assign\(raw.data\(\),raw.size\(\)\)/);
  assert.match(cpp, /std::optional<OwnedRaw> raw/);
  assert.match(cpp, /std::vector<OwnedRaw> other/);
  assert.match(cpp, /simdjson::serialize_tag/);
  assert.match(
    nativeSchema([], "Map<string, JSON.Raw>"),
    /using Root=std::map<std::string,OwnedRaw>/,
  );
  assert.match(nativeSchema([], "string"), /requires_raw_validation=false/);
});
test("dynamic and unknown types cannot silently become selective native views", () => {
  for (const type of ["JSON.Value", "Unknown"])
    assert.throws(() => cppType(type, new Set()), /Unsupported type/);
});
test("user initialization cannot silently become native zero initialization", () => {
  assert.throws(
    () => nativeSchema(schema("@json class Item { n:i32=17; }"), "Item"),
    /initializer/,
  );
});
test("unmapped schema behaviors fail closed", () => {
  for (const source of [
    "@json class Item extends Base { n:i32; }",
    "@json class Item<T> { n:T; }",
    "@json class Item { static n:i32; }",
    "@json class Item { @omit n:i32; }",
    "@json class Item { custom():void {} }",
    "@json @custom class Item { n:i32; }",
  ])
    assert.throws(() => schema(source), /exact mapping|Unsupported/);
});

test("numeric diagnostics preserve decimal tokens across shape and value rotations", () => {
  const text =
    "[[1.00000000000000001,2e-9],[-3.2500,4.5],[6.7,8.9],[10.01,-11.02]]";
  const pairs = coordinatePayloads(text, "pairs", 4),
    flat = coordinatePayloads(text, "flat", 4);
  assert.equal(pairs[0], text);
  assert.match(flat[0], /1\.00000000000000001,2e-9,-3\.2500/);
  assert.equal(new Set(flat).size, 4);
  for (let i = 0; i < 4; i++)
    assert.deepEqual(JSON.parse(flat[i]), JSON.parse(pairs[i]).flat());
  assert.throws(() => coordinatePayloads(text, "flat", 5), /Insufficient/);
});

test("owned string inputs cover clean, escaped and Unicode text with changing lengths", () => {
  for (const shape of [
    "short",
    "clean",
    "late",
    "dense",
    "unicode",
    "fullwidth",
    "fullwidth_escaped",
    "fullwidth_pairs",
    "fullwidth_short",
    "fullwidth_transition",
  ]) {
    const inputs = stringPayloads(shape);
    const values = inputs.map((input) => JSON.parse(input));
    assert.equal(new Set(values).size, 4);
    assert.equal(new Set(values.map((value) => value.length)).size, 4);
    assert.ok(values.every((value) => typeof value === "string"));
  }
  assert.ok(JSON.parse(stringPayloads("late")[0]).endsWith('"'));
  assert.ok(JSON.parse(stringPayloads("dense")[0]).includes('"\\\n'));
  assert.ok(JSON.parse(stringPayloads("unicode")[0]).includes("😀"));
  assert.ok(JSON.parse(stringPayloads("fullwidth")[0]).includes("，"));
  const escapedFullwidth = JSON.parse(stringPayloads("fullwidth_escaped")[0]);
  assert.ok(escapedFullwidth.includes('"') && escapedFullwidth.includes("\n"));
  const pairedFullwidth = JSON.parse(stringPayloads("fullwidth_pairs")[0]);
  assert.ok(pairedFullwidth.includes("，") && pairedFullwidth.includes("🦋"));
  const shortFullwidth = JSON.parse(stringPayloads("fullwidth_short")[0]);
  assert.ok(shortFullwidth.length >= 8 && shortFullwidth.length < 16);
  const transition = JSON.parse(stringPayloads("fullwidth_transition")[0]);
  assert.ok(transition.slice(0, 8).includes("，"));
  assert.ok(!/[\ud800-\udfff]/.test(transition.slice(0, 8)));
  const quote = transition.indexOf('"');
  assert.ok(quote >= 16);
  assert.ok(transition.slice(quote + 1).startsWith("中".repeat(24)));
  assert.throws(() => stringPayloads("missing"), /Unknown/);
});
