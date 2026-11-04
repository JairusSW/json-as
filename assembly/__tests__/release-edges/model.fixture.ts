import { JSON } from "../..";
export namespace M {

  @json export class Base {
    value: i32 = 7;
  }
  export enum State {
    Off,
    On,
  }
  let calls: i32 = 0;

  @json class Token {
    value: i32 = 0;

    @deserializer("number") decode(_s: string): Token {
      calls++;
      return new Token();
    }
  }
  export type Deferred = JSON.Lazy<Token>;
  export function make(): Deferred {
    return new Token();
  }
  export function count(): i32 {
    return calls;
  }
}
