import { JSON } from "../..";
import { Self } from "./generic-self-alias.fixture";

@json export class Token<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }

  @serializer("number") encode(self: Self<T>): string {
    return self.value.toString();
  }
}
export function run(): string {
  return JSON.stringify(new Token<i32>(7));
}
