import { JSON } from "..";
import { describe, expect } from "as-test";

function checkPrimitive<T>(value: T): void {
  // The standalone Value dispatcher remains the reference implementation.
  const expected = JSON.stringify(JSON.Value.from<T>(value));
  const array = new JSON.Arr();
  array.push<usize>(0);
  array.push<T>(value);
  array.push<bool>(true);
  const object = new JSON.Obj();
  object.set<usize>("before", 0);
  object.set<T>("value", value);
  object.set<bool>("after", true);
  const arrayBits = unchecked(array._vals[1]);
  const objectBits = unchecked(object._vals[1]);
  let arrayOutput = JSON.stringify(array);
  let objectOutput = JSON.stringify(object);
  expect(arrayOutput).toBe("[null," + expected + ",true]");
  expect(objectOutput).toBe(
    '{"before":null,"value":' + expected + ',"after":true}',
  );
  __collect();
  arrayOutput = JSON.stringify(array, arrayOutput);
  objectOutput = JSON.stringify(object, objectOutput);
  expect(arrayOutput).toBe("[null," + expected + ",true]");
  expect(objectOutput).toBe(
    '{"before":null,"value":' + expected + ',"after":true}',
  );
  expect(unchecked(array._vals[1])).toBe(arrayBits);
  expect(unchecked(object._vals[1])).toBe(objectBits);
}

describe("Dynamic primitive slots preserve integer tags and wide payloads", () => {
  checkPrimitive<usize>(0);
  checkPrimitive<bool>(false);
  checkPrimitive<bool>(true);
  checkPrimitive<u8>(0);
  checkPrimitive<u8>(u8.MAX_VALUE);
  checkPrimitive<u16>(u16.MAX_VALUE);
  checkPrimitive<u32>(u32.MAX_VALUE);
  checkPrimitive<i8>(i8.MIN_VALUE);
  checkPrimitive<i8>(i8.MAX_VALUE);
  checkPrimitive<i16>(i16.MIN_VALUE);
  checkPrimitive<i16>(i16.MAX_VALUE);
  checkPrimitive<i32>(i32.MIN_VALUE);
  checkPrimitive<i32>(i32.MAX_VALUE);
  checkPrimitive<u64>(0);
  checkPrimitive<u64>(((<u64>1) << 45) - 1);
  checkPrimitive<u64>((<u64>1) << 45);
  checkPrimitive<u64>(u64.MAX_VALUE);
  checkPrimitive<i64>(0);
  checkPrimitive<i64>(-((<i64>1) << 44));
  checkPrimitive<i64>(((<i64>1) << 44) - 1);
  checkPrimitive<i64>(-((<i64>1) << 44) - 1);
  checkPrimitive<i64>((<i64>1) << 44);
  checkPrimitive<i64>(i64.MIN_VALUE);
  checkPrimitive<i64>(i64.MAX_VALUE);
});

describe("Dynamic primitive slots preserve float widths and exceptional values", () => {
  checkPrimitive<f32>(0);
  checkPrimitive<f32>(-0.0);
  checkPrimitive<f32>(1.25);
  checkPrimitive<f32>(f32.MIN_VALUE);
  checkPrimitive<f32>(f32.MAX_VALUE);
  checkPrimitive<f32>(f32.NaN);
  checkPrimitive<f32>(f32.POSITIVE_INFINITY);
  checkPrimitive<f32>(f32.NEGATIVE_INFINITY);
  checkPrimitive<f64>(0);
  checkPrimitive<f64>(-0.0);
  checkPrimitive<f64>(-1.25);
  checkPrimitive<f64>(f64.MIN_VALUE);
  checkPrimitive<f64>(f64.MAX_VALUE);
  checkPrimitive<f64>(f64.NaN);
  checkPrimitive<f64>(f64.POSITIVE_INFINITY);
  checkPrimitive<f64>(f64.NEGATIVE_INFINITY);
});


@json
class ReentrantSlot {
  value: i32 = 7;


  @serializer("string")
  serialize(self: ReentrantSlot): string {
    const nested = new JSON.Arr();
    nested.push<i32>(self.value);
    nested.push<bool>(false);
    return JSON.stringify(nested);
  }
}

describe("Dynamic primitive slot dispatch preserves references and custom calls", () => {
  const nested = new JSON.Arr();
  nested.push<i64>(i64.MIN_VALUE);
  nested.push<bool>(true);
  const object = new JSON.Obj();
  object.set<usize>("null", 0);
  object.set<string>("string", 'text"\\\n');
  object.set<JSON.Arr>("nested", nested);
  object.set<ReentrantSlot>("custom", new ReentrantSlot());
  object.set<f64>("last", 2.5);
  const expected =
    '{"null":null,"string":"text\\"\\\\\\n","nested":[-9223372036854775808,true],"custom":[7,false],"last":2.5}';
  let out = JSON.stringify(object);
  expect(out).toBe(expected);
  __collect();
  out = JSON.stringify(object, out);
  expect(out).toBe(expected);
  const array = new JSON.Arr();
  array.push<usize>(0);
  array.push<ReentrantSlot>(new ReentrantSlot());
  array.push<JSON.Obj>(object);
  array.push<f32>(1.25);
  expect(JSON.stringify(array)).toBe("[null,[7,false]," + expected + ",1.25]");
});

describe("Dynamic primitive slot dispatch leaves deferred values deferred", () => {
  const source = '[1,true,null,"escaped\\n",[2.0],{"x":3.0}]';
  const array = JSON.parse<JSON.Arr>(source);
  const lazy = unchecked(array._vals[3]);
  expect(JSON.Value.slotIsLazy(lazy)).toBe(true);
  expect(JSON.stringify(array)).toBe(source);
  expect(unchecked(array._vals[3])).toBe(lazy);
  const object = JSON.parse<JSON.Obj>(
    '{"before":1,"lazy":[2.0],"after":false}',
  );
  object.set<i32>("before", 7); // Leave the raw-object passthrough path.
  const objectLazy = unchecked(object._vals[1]);
  expect(JSON.Value.slotIsLazy(objectLazy)).toBe(true);
  expect(JSON.stringify(object)).toBe(
    '{"before":7,"lazy":[2.0],"after":false}',
  );
  expect(unchecked(object._vals[1])).toBe(objectLazy);
});
