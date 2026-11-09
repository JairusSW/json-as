import { JSONMode, toRaw, fromRaw, toBox } from "../../../index";
export function run(): string {
  return (
    fromRaw(toRaw('{"x":1}')) +
    "|" +
    toBox<i32>(7).value.toString() +
    "|" +
    JSONMode.SWAR.toString()
  );
}
