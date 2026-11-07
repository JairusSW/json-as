import { JSON } from "../index";

@json class Row {
  n: i32 = 0;
  numbers: i64[] = [];
  labels: string[] = [];
}

@json class Root {
  rows: Row[] = [];
}
class Numbers extends Array<i64> {
  label: string = "retained".repeat(64);
}
let special: Numbers | null = null;
let first: Root | null = null;
let last: Root | null = null;
const source =
  '{"rows":[{"n":7,"numbers":[],"labels":["alpha"]},{"n":8,"numbers":[],"labels":[]}]}';
export function verify(): i32 {
  special = new Numbers();
  special!.push(777);
  first = JSON.parse<Root>(source);
  __collect();
  for (let i = 0; i < 5000; i++) {
    last = JSON.parse<Root>(source);
    if ((i & 31) == 0) first!.rows[0].numbers.push(<i64>i);
  }
  __collect();
  assert(first!.rows[0].n == 7 && first!.rows[0].labels[0] == "alpha");
  assert(last!.rows[1].n == 8 && last!.rows[1].numbers.length == 0);
  const values = first!.rows[0].numbers;
  assert(values.length == 157);
  for (let i = 0; i < values.length; i++) assert(values[i] == <i64>(i * 32));
  assert(
    special!.length == 1 &&
      special![0] == 777 &&
      special!.label == "retained".repeat(64),
  );
  return 1;
}
