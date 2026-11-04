
@json class Token {
  value: i32 = 0;

  @serializer("number") encode(self: Token): string {
    return self.value.toString();
  }

  @deserializer("number") decode(data: string): Token {
    const out = new Token();
    out.value = <i32>parseInt(data);
    return out;
  }
}
type Identity<T> = T;
export type PublicToken = Identity<Token>;
export function make(): PublicToken {
  return new Token();
}
