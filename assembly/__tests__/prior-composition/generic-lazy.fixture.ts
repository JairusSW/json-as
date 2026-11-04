import { JSON } from "../..";

@json class Owner<T> {
  value!: JSON.Lazy<T>;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner<i32>>('{"value":7}'));
}
