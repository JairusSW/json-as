import test from "node:test";
import assert from "node:assert/strict";
import { schemaFromSource, cppType, nativeSchema } from "./generate.mjs";
const schema = (source) => schemaFromSource(source, "fixture.ts");
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
});
test("nested map and boxed values keep their concrete type", () => {
  assert.equal(
    cppType("Map<string,Array<JSON.Box<u64>>>", new Set()),
    "std::map<std::string,std::vector<uint64_t>>",
  );
});
test("raw and dynamic values cannot silently become selective native views", () => {
  for (const type of ["JSON.Raw", "JSON.Value", "Unknown"])
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
