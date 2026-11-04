import { JSON } from "../..";
import { RemoteSelf } from "./self-alias.fixture";
type Self = RemoteSelf;

@json export class Token {
  value: i32 = 7;

  @serializer("number") encode(self: Self): string {
    return self.value.toString();
  }
}
export function run(): string {
  return JSON.stringify(new Token());
}
