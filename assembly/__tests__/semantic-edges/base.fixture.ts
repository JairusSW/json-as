const INITIAL_COUNT: i32 = 7;
let calls: i32 = 0;
function initial(): i32 {
  calls++;
  return INITIAL_COUNT;
}
export function reset(): void {
  calls = 0;
}
export function count(): i32 {
  return calls;
}
export class Base<T> {
  value: T = changetype<T>(initial());
}
