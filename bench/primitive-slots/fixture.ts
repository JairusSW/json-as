import { JSON } from "../../assembly";

let array = new JSON.Arr();
let object = new JSON.Obj();
let result = "";
let objectMode = false;

function put<T>(key: string, value: T): void {
  if (objectMode) object.set<T>(key, value);
  else array.push<T>(value);
}

export function setup(length: i32, kind: i32, useObject: bool): void {
  array = new JSON.Arr();
  object = new JSON.Obj();
  objectMode = useObject;
  for (let i = 0; i < length; i++) {
    const key = i.toString();
    switch (kind) {
      case 0:
        put<usize>(key, 0);
        break;
      case 1:
        put<bool>(key, i % 2 == 0);
        break;
      case 2:
        put<f64>(key, <f64>i + 0.25);
        break;
      case 3:
        put<i64>(key, i64.MIN_VALUE + i);
        break;
      case 4:
        put<string>(key, "text");
        break;
    }
  }
  result = objectMode ? JSON.stringify(object) : JSON.stringify(array);
  __collect();
}

export function run(reuse: bool): void {
  if (objectMode) result = JSON.stringify(object, reuse ? result : null);
  else result = JSON.stringify(array, reuse ? result : null);
}

export function output(): string {
  return result;
}
