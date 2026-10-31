import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Dynamic objects preserve keys beyond the u16 length boundary", () => {
  const lengths: i32[] = [65534, 65535, 65536, 131073];
  for (let j = 0; j < lengths.length; j++) {
    const key = "k".repeat(lengths[j]);
    const obj = new JSON.Obj();
    obj.set(key, 7);
    expect(obj.has(key)).toBe(true);
    expect(obj.getAs<i32>(key)).toBe(7);
    expect(obj.keys()[0] == key).toBe(true);
    const source = '{"' + key + '":7}';
    expect(JSON.stringify(obj) == source).toBe(true);
    const parsed = JSON.parse<JSON.Obj>(source);
    expect(parsed.has(key)).toBe(true);
    expect(parsed.getAs<f64>(key)).toBe(7.0);
    parsed.set("tail", true);
    expect(
      JSON.stringify(parsed) == source.slice(0, -1) + ',"tail":true}',
    ).toBe(true);
    for (let i = 0; i < 40; i++) parsed.set("s" + i.toString(), i);
    expect(parsed.getAs<f64>(key)).toBe(7.0);
    expect(parsed.delete(key)).toBe(true);
    expect(parsed.has(key)).toBe(false);
    expect(parsed.getAs<bool>("tail")).toBe(true);
  }
});
