import { JSON } from "../../index";
class HiddenRows<T> extends Array<T> {
  get length(): i32 {
    return 0;
  }
  set length(value: i32) {
    super.length = value;
  }
}

@json class Row {
  value: i32 = 7;
}

@json class Owner {
  flags: HiddenRows<bool> = new HiddenRows<bool>();
  text: HiddenRows<string> = new HiddenRows<string>();
  rows: HiddenRows<Row> = new HiddenRows<Row>();
}
export function run(): string {
  const o = new Owner();
  o.flags.push(true);
  o.flags.push(false);
  o.text.push("one");
  o.text.push("two");
  o.rows.push(new Row());
  const v = new HiddenRows<JSON.Value>();
  v.push(JSON.Value.from<i32>(7));
  return (
    JSON.stringify(o) +
    "|" +
    JSON.stringify(v) +
    "|" +
    JSON.stringify(JSON.Arr.from(v)) +
    "|" +
    JSON.stringify(JSON.Value.from(v))
  );
}
