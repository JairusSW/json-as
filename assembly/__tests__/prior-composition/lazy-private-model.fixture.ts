import { JSON } from "../..";

@json class Hidden {
  value: i32 = 7;
}

@json export class Base {
  value: JSON.Lazy<Hidden> = new Hidden();
}
