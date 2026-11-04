import { JSON } from "../..";
export let calls: i32 = 0;

@json class Codec {
  value: i32 = 7;

  @deserializer("object") decode(_source: string): Codec {
    calls++;
    return new Codec();
  }
}
export type PublicLazy = JSON.Lazy<Codec>;
export function make(): PublicLazy {
  return new Codec();
}
