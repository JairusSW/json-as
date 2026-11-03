import { JSON } from "..";


@json class FloatValue {
  value: f32 = 0;
}
let reused = new FloatValue();
export const stringId = idof<string>();
export function root(input: string): u32 {
  return reinterpret<u32>(JSON.parse<f32>(input));
}
export function field(input: string, reuse: bool): u32 {
  return reinterpret<u32>(
    JSON.parse<FloatValue>(
      '{"value":' + input + "}",
      reuse ? reused : changetype<FloatValue>(0),
    ).value,
  );
}
export function array(input: string): u32 {
  return reinterpret<u32>(JSON.parse<f32[]>("[" + input + "]")[0]);
}
