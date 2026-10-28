import { JSON } from "..";
import { describe, expect } from "as-test";
import { scanQuotedValueEnd_SWAR } from "../deserialize/swar/array/shared";


@json
class TextValue {
  text: string = "";
}


@json
class ArrayFields {
  values: string[] = [];
  tail: i32 = 0;
}


@json
class ObjectFields {
  value: TextValue = new TextValue();
  tail: i32 = 0;
}


@json
class NestedFields {
  objects: TextValue[] = [];
  arrays: ArrayFields = new ArrayFields();
  tail: i32 = 0;
}


@json
class ArraySlice {
  raw: string = "";


  @deserializer("array")
  deserialize(data: string): ArraySlice {
    const out = new ArraySlice();
    out.raw = data;
    return out;
  }
}


@json
class ObjectSlice {
  raw: string = "";


  @deserializer("object")
  deserialize(data: string): ObjectSlice {
    const out = new ObjectSlice();
    out.raw = data;
    return out;
  }
}


@json
class CustomFields {
  array: ArraySlice = new ArraySlice();
  object: ObjectSlice = new ObjectSlice();
  tail: i32 = 0;
}

// Include even runs before closing quotes and odd runs before escaped quotes.
// Structural characters inside the string must not change the enclosing depth.
const TEXTS = makeTexts();

function makeTexts(): string[] {
  const texts = [
    "plain",
    "\\",
    "\\\\",
    "\\\\\\",
    "\\\\\\\\",
    '"},][{',
    '\\"},][{',
    '\\\\"},][{\\',
  ];
  // Shift odd/even escape runs through every lane and across SWAR boundaries.
  for (let prefixLength = 0; prefixLength < 8; prefixLength++) {
    const prefix = "abcdefg".slice(0, prefixLength);
    let slashes = "";
    for (let count = 1; count <= 4; count++) {
      slashes += "\\";
      texts.push(prefix + slashes);
      texts.push(prefix + slashes + '\"},][{' + slashes);
    }
  }
  return texts;
}

describe("Shared quoted-value scanner retains escape parity at chunk boundaries", () => {
  for (let i = 0; i < TEXTS.length; i++) {
    const quoted = JSON.stringify(TEXTS[i]);
    const start = changetype<usize>(quoted);
    const end = start + ((<usize>quoted.length) << 1);
    expect(scanQuotedValueEnd_SWAR(start, end)).toBe(end);
    const withSuffix = quoted + ',{"tail":1}';
    const suffixStart = changetype<usize>(withSuffix);
    expect(
      scanQuotedValueEnd_SWAR(
        suffixStart,
        suffixStart + ((<usize>withSuffix.length) << 1),
      ),
    ).toBe(suffixStart + ((<usize>quoted.length) << 1));
  }
});

describe("Generated array fields preserve closing quotes after backslashes", () => {
  const out = new ArrayFields();
  for (let i = 0; i < TEXTS.length; i++) {
    const text = TEXTS[i];
    const values = "[" + JSON.stringify(text) + ',"after"]';
    const inputs = [
      '{"values":' + values + ',"tail":7}',
      '{ "tail" : 7, "values" : ' + values + " }",
    ];
    for (let j = 0; j < inputs.length; j++) {
      const fresh = JSON.parse<ArrayFields>(inputs[j]);
      expect(fresh.values.length).toBe(2);
      expect(fresh.values[0]).toBe(text);
      expect(fresh.values[1]).toBe("after");
      expect(fresh.tail).toBe(7);
      const reused = JSON.parse<ArrayFields>(inputs[j], out);
      expect(changetype<usize>(reused)).toBe(changetype<usize>(out));
      expect(reused.values.length).toBe(2);
      expect(reused.values[0]).toBe(text);
      expect(reused.values[1]).toBe("after");
      expect(reused.tail).toBe(7);
    }
  }
});

describe("Generated object fields preserve closing quotes after backslashes", () => {
  const out = new ObjectFields();
  for (let i = 0; i < TEXTS.length; i++) {
    const text = TEXTS[i];
    const value = '{"text":' + JSON.stringify(text) + "}";
    const inputs = [
      '{"value":' + value + ',"tail":9}',
      '{ "tail" : 9, "value" : ' + value + " }",
    ];
    for (let j = 0; j < inputs.length; j++) {
      const fresh = JSON.parse<ObjectFields>(inputs[j]);
      expect(fresh.value.text).toBe(text);
      expect(fresh.tail).toBe(9);
      const reused = JSON.parse<ObjectFields>(inputs[j], out);
      expect(changetype<usize>(reused)).toBe(changetype<usize>(out));
      expect(reused.value.text).toBe(text);
      expect(reused.tail).toBe(9);
    }
  }
});

describe("Generated composite fields retain nested depth around escaped strings", () => {
  for (let i = 0; i < TEXTS.length; i++) {
    const text = TEXTS[i];
    const quoted = JSON.stringify(text);
    const input =
      '{ "tail" : 11, "arrays" : { "tail" : 3, "values" : [' +
      quoted +
      '] }, "objects" : [{"text":' +
      quoted +
      '},{"text":"after"}] }';
    const fresh = JSON.parse<NestedFields>(input);
    expect(fresh.tail).toBe(11);
    expect(fresh.arrays.tail).toBe(3);
    expect(fresh.arrays.values.length).toBe(1);
    expect(fresh.arrays.values[0]).toBe(text);
    expect(fresh.objects.length).toBe(2);
    expect(fresh.objects[0].text).toBe(text);
    expect(fresh.objects[1].text).toBe("after");
  }
});

describe("Generated custom fields receive exact array and object slices", () => {
  for (let i = 0; i < TEXTS.length; i++) {
    const quoted = JSON.stringify(TEXTS[i]);
    const array = "[" + quoted + ',{"text":' + quoted + "}]";
    const object = '{"text":' + quoted + ',"nested":[' + quoted + "]}";
    const input =
      '{ "tail" : 13, "object" : ' + object + ', "array" : ' + array + " }";
    const fresh = JSON.parse<CustomFields>(input);
    expect(fresh.tail).toBe(13);
    expect(fresh.array.raw).toBe(array);
    expect(fresh.object.raw).toBe(object);
  }
});
