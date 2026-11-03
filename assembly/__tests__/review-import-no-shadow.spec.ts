import { JSON } from "..";
import { describe, expect } from "as-test";
import { ImportedReviewBase } from "./review-import-base.fixture";


@json class UnshadowedChild extends ImportedReviewBase {
  label: string = "child";
}
describe("inherited defaults can reference private names absent in this module", () => {
  expect(JSON.parse<UnshadowedChild>("{}").count).toBe(7);
});
