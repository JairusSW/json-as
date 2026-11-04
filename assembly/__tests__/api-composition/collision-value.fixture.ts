import { JSON } from "../..";


@json class Row {
  __name_val: string = "ordinary";
  name: JSON.Lazy<string> = "default";
}
export function run(): string {
  const out = JSON.parse<Row>('{"name":"default"}');
  assert(out.name == "default");
  return JSON.stringify(out);
}
