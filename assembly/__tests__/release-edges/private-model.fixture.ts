import { JSON } from "../..";

@json class Hidden<T = i32> {
  value: T = changetype<T>(7);
}
enum State {
  Off,
  On,
}
export type DeferredArray = JSON.Lazy<Hidden[]>;
export type DeferredGeneric<T> = JSON.Lazy<Hidden<T>>;
export type DeferredEnum = JSON.Lazy<State>;
export function array(): DeferredArray {
  return [];
}
export function generic(): DeferredGeneric<i32> {
  return new Hidden<i32>();
}
export function en(): DeferredEnum {
  return State.Off;
}
