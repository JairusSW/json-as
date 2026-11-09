import { JSON } from "../../index";
function callback(): i32 {
  return 7;
}

@json class WithField {
  callback: () => i32 = callback;
  value: i32 = 0;
}
export function run(): string {
  const out = JSON.parse<WithField>('{"value":9}');
  return out.callback().toString() + ":" + out.value.toString();
}
