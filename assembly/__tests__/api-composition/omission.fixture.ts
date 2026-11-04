import { JSON } from "../..";
import { Base, ExpressionBase } from "./omission-model.fixture";
function shouldOmit(_self: Base): bool {
  return false;
}
const OMIT: bool = false;


@json class Child extends Base {
  next: i32 = 9;
}


@json class ExpressionChild extends ExpressionBase {
  next: i32 = 9;
}
export function run(): string {
  return (
    JSON.stringify(new Child()) + "|" + JSON.stringify(new ExpressionChild())
  );
}
