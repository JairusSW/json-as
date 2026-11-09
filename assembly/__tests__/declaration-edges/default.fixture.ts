import { JSON } from "../../index";
import Remote from "./default-model.fixture";

@json class Child extends Remote {
  tail: i32 = 9;
}
export function run(): string {
  return (
    JSON.stringify(new Child()) +
    "|" +
    JSON.parse<Child>('{"value":5,"tail":9}').value.toString()
  );
}
