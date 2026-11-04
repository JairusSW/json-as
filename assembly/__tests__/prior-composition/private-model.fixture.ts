import { JSON } from "../..";

@json class Hidden {
  value: i32 = 7;
}
enum State {
  Off,
  On,
}
export type PublicArray = Array<Hidden>;
export type PublicState = State;
export type PublicMaybeLazy = JSON.Lazy<Hidden | null>;
export function make(): PublicArray {
  return [new Hidden()];
}

@json export class Base {
  value: Hidden = new Hidden();
}
