import { JSON } from "..";

export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function rawLength(input: string): i32 {
  return JSON.parse<JSON.Raw[]>(input).length;
}
export function boxLength(input: string): i32 {
  return JSON.parse<JSON.Box<bool>[]>(input).length;
}
