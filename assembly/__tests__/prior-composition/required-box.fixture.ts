import { JSON } from "../..";

@json class Owner {
  raw!: JSON.Box<i32>;
  values!: Map<string, i32>;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"raw":7,"values":{"x":1}}'));
}
