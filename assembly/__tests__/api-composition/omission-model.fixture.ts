import { JSON } from "../..";
function shouldOmit(_self: Base): bool {
  return true;
}
const OMIT: bool = true;


@json export class Base {

  @omitif(shouldOmit) value: i32 = 7;
}


@json export class ExpressionBase {

  @omitif("OMIT") value: i32 = 7;
}
