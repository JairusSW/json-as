import { JSON } from "../..";
export namespace Model {

  @json class Hidden {
    value: i32 = 7;
  }

  @json export class Base {
    value: Hidden = new Hidden();
  }
}
