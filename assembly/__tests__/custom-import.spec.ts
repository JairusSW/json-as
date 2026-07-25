import { JSON } from "..";
import { describe, expect } from "as-test";
import { ImportedCustomPoint } from "./fixtures/imported-custom-point";


@json
class ObjectWithImportedCustom {
  value: ImportedCustomPoint = new ImportedCustomPoint();

  constructor(value: ImportedCustomPoint = new ImportedCustomPoint()) {
    this.value = value;
  }
}


@json
class NullableImportedCustom {
  value: ImportedCustomPoint | null = null;
}

describe("Should deserialize an imported custom type nested in an object", () => {
  const value = new ObjectWithImportedCustom(
    new ImportedCustomPoint(1.25, -2.5),
  );
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('{"value":"1.25,-2.5"}');

  const parsed = JSON.parse<ObjectWithImportedCustom>(encoded);
  expect(parsed.value.x.toString()).toBe("1.25");
  expect(parsed.value.y.toString()).toBe("-2.5");
  expect(JSON.stringify(parsed)).toBe(encoded);
});

describe("Should deserialize nullable imported custom fields", () => {
  const parsed = JSON.parse<NullableImportedCustom>('{"value":"3.0,4.5"}');
  expect(parsed.value == null).toBe(false);
  expect(parsed.value!.x.toString()).toBe("3.0");
  expect(parsed.value!.y.toString()).toBe("4.5");
  expect(JSON.stringify(parsed)).toBe('{"value":"3.0,4.5"}');

  const empty = JSON.parse<NullableImportedCustom>('{"value":null}');
  expect(empty.value == null).toBe(true);
});
