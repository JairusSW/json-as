import { JSON } from "../..";


@json class Row {
  __src: string = "ordinary";
  value: JSON.Lazy<i32> = 0;
}
export function run(): string {
  const out = JSON.parse<Row>('{"value":7}');
  assert(out.value == 7);
  return JSON.stringify(out);
}
