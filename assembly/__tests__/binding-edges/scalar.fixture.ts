import { JSON } from "../..";
import { Plain, Decorated } from "./scalar-model.fixture";
type Scalar = i32;

@json class A extends Plain {
  tail: i32 = 9;
}

@json class B extends Decorated {
  tail: i32 = 9;
}
export function run(): string {
  assert(new A().value == 1.5);
  assert(new B().value == 1.5);
  return JSON.stringify(new A()) + ":" + JSON.stringify(new B());
}
