import { JSON } from "../..";


@json class Token {

  @serializer("array") encode(_self: Token): string {
    const out: i32[] = [];
    JSON.parse<i32[]>("[1,2]", out);
    return JSON.stringify(out);
  }
}
export function run(): string {
  return JSON.stringify(new Token());
}
