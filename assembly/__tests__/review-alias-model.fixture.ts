import { JSON } from "..";

@json class Hidden {
  value: i32 = 7;
}
export type PublicLazy = JSON.Lazy<Hidden>;
export function make(): PublicLazy {
  return new Hidden();
}

@json class HiddenGeneric<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}
export type PublicAlias = HiddenGeneric<i32>;
export function makeGeneric(): PublicAlias {
  return new HiddenGeneric<i32>(9);
}
