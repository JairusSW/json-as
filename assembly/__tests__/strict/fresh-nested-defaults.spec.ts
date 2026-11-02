import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class ImplicitChild {
  value!: string;
}


@json
class ImplicitParent {
  child!: ImplicitChild;
}

let nestedDefaultCalls = 0;

function nestedDefaultValue(): string {
  nestedDefaultCalls++;
  return "default";
}


@json
class ObservableChild {
  value: string = nestedDefaultValue();
}


@json
class ObservableParent {
  child!: ObservableChild;
}

describe("fresh checked nested defaults", () => {
  const present = JSON.parse<ImplicitParent>('{"child":{"value":"ok"}}');
  expect(present.child.value).toBe("ok");
  expect(JSON.stringify(present)).toBe('{"child":{"value":"ok"}}');

  const missing = JSON.parse<ImplicitParent>("{}");
  expect(missing.child.value).toBe("");
  expect(JSON.stringify(missing)).toBe('{"child":{"value":""}}');

  // Explicit nested defaults are observable: the original default graph and
  // the parsed replacement must each evaluate the initializer.
  nestedDefaultCalls = 0;
  const observablePresent = JSON.parse<ObservableParent>(
    '{"child":{"value":"input"}}',
  );
  expect(observablePresent.child.value).toBe("input");
  expect(nestedDefaultCalls).toBe(2);

  nestedDefaultCalls = 0;
  const observableMissing = JSON.parse<ObservableParent>("{}");
  expect(observableMissing.child.value).toBe("default");
  expect(nestedDefaultCalls).toBe(1);
});
