import { JSON } from "..";
import { describe, expect } from "as-test";

// JSON.Lazy (on-demand cursor) must read exactly what eager JSON.parse produces.
describe("JSON.Lazy reads match eager", () => {
  const src =
    '{"id":42,"name":"Small Object","active":true,"ratio":-2.5,"tags":[10,20,30]}';
  const c = JSON.Lazy.parse(src);

  expect(JSON.Lazy.getI32(c, "id").toString()).toBe("42");
  expect(JSON.Lazy.getString(c, "name")).toBe("Small Object");
  expect(JSON.Lazy.getBool(c, "active") ? "t" : "f").toBe("t");
  expect(JSON.Lazy.getF64(c, "ratio").toString()).toBe("-2.5");

  // navigation + array indexing, no allocation
  const tags = JSON.Lazy.get(c, "tags");
  expect(JSON.Lazy.length(tags).toString()).toBe("3");
  expect(JSON.Lazy.asI32(JSON.Lazy.at(tags, 1)).toString()).toBe("20");

  // zero-alloc string ops
  expect(JSON.Lazy.stringLength(JSON.Lazy.get(c, "name")).toString()).toBe(
    "12",
  );
  expect(
    JSON.Lazy.stringEq(JSON.Lazy.get(c, "name"), "Small Object") ? "y" : "n",
  ).toBe("y");

  // absent key -> 0 cursor; nested skip past array to reach a later key works
  expect(JSON.Lazy.get(c, "missing").toString()).toBe("0");
});

describe("JSON.Lazy unescapes strings like eager", () => {
  const c = JSON.Lazy.parse('{"msg":"he said \\"hi\\"\\n"}');
  expect(JSON.Lazy.getString(c, "msg")).toBe(
    JSON.parse<string>('"he said \\"hi\\"\\n"'),
  );
});
