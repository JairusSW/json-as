import { JSON } from "../../index";
function callback(): i32 {
  return 7;
}

@json class CallbackOnly {
  callback: () => i32 = callback;
}

@json class WithField {
  callback: () => i32 = callback;
  value: i32 = 0;
}
export function run(): string {
  return JSON.stringify(new CallbackOnly());
}
