import { JSON } from "../..";
type T = i32;
type Identity<U> = U;

@json class Holder<T> {
  value: Identity<T>;
  constructor(value: T) {
    this.value = value;
  }
}
export function run(): string {
  return JSON.stringify(new Holder<f32>(1.5));
}
