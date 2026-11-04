import { JSON } from "../..";

@json class Base {
  __name_val: string = "base";
}

@json class Child extends Base {
  name: JSON.Lazy<string> = "child";
}
export function run(): string {
  return JSON.stringify(new Child());
}
