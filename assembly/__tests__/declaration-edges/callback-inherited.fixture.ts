import { JSON } from "../../index";
function callback(): i32 {
  return 7;
}
type Callback = () => i32;
class Base {
  callback: Callback = callback;
}

@json class Child extends Base {
  value: i32 = 0;
}
export function run(): string {
  const out = JSON.parse<Child>('{"value":9}');
  return out.callback().toString() + ":" + out.value.toString();
}
