import { JSON } from "..";
import { describe, expect } from "as-test";
import { ImportedCustomPoint } from "./fixtures/imported-custom-point";


@json
class ObjectWithImportedCustom {
  value: ImportedCustomPoint = new ImportedCustomPoint();
  label: string = "";

  constructor(
    value: ImportedCustomPoint = new ImportedCustomPoint(),
    label: string = "",
  ) {
    this.value = value;
    this.label = label;
  }
}


@json
class NullableImportedCustom {
  value: ImportedCustomPoint | null = null;
  label: string = "";
}

describe("Should deserialize an imported custom type nested in an object", () => {
  const value = new ObjectWithImportedCustom(
    new ImportedCustomPoint(1.25, -2.5),
    "fast",
  );
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('{"value":"1.25,-2.5","label":"fast"}');

  const parsed = JSON.parse<ObjectWithImportedCustom>(encoded);
  expect(parsed.value.x.toString()).toBe("1.25");
  expect(parsed.value.y.toString()).toBe("-2.5");
  expect(parsed.label).toBe("fast");
  expect(JSON.stringify(parsed)).toBe(encoded);
});

describe("Should deserialize imported custom fields on the slow path", () => {
  const parsed = JSON.parse<ObjectWithImportedCustom>(
    '{"label":"slow","value":"6.25,-7.5"}',
  );
  expect(parsed.value.x.toString()).toBe("6.25");
  expect(parsed.value.y.toString()).toBe("-7.5");
  expect(parsed.label).toBe("slow");
});

describe("Should deserialize nullable imported custom fields", () => {
  const parsed = JSON.parse<NullableImportedCustom>(
    '{"label":"value","value":"3.0,4.5"}',
  );
  expect(parsed.value == null).toBe(false);
  expect(parsed.value!.x.toString()).toBe("3.0");
  expect(parsed.value!.y.toString()).toBe("4.5");
  expect(parsed.label).toBe("value");
  expect(JSON.stringify(parsed)).toBe('{"value":"3.0,4.5","label":"value"}');

  const empty = JSON.parse<NullableImportedCustom>(
    '{"label":"empty","value":null}',
  );
  expect(empty.value == null).toBe(true);
  expect(empty.label).toBe("empty");
});
