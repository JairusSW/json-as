import { JSON } from "../..";


@json class Row {

  @omitif(() => false) value: i32 = 7;
}
export function run(): string {
  return JSON.stringify(new Row());
}
