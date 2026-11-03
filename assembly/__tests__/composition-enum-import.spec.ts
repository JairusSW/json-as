import { JSON } from "..";
import { describe, expect } from "as-test";

import { State as StateAlias } from "./composition-enum.fixture";


@json class EnumField {
  value: StateAlias = StateAlias.Off;
}
describe("renamed imported enums remain numeric", () => {
  expect(JSON.parse<StateAlias>("1")).toBe(StateAlias.On);
  expect(JSON.parse<EnumField>('{"value":1}').value).toBe(StateAlias.On);
});
