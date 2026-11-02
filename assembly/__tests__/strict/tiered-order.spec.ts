import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class TieredRecord {
  id!: i32;
  name!: string;
  active!: bool;
}

describe("expected-order cursor continuation", () => {
  const sources = [
    '{"id":7,"name":"Ada","active":true}',
    '{"id":7,"active":true,"name":"Ada"}',
    '{"active":true,"name":"Ada","id":7}',
    '{"id" : 7,"name" : "Ada","active" : true}',
    '{"id":7,"na\\u006de":"Ada","active":true}',
    '{"id":0,"name":"Ada","active":true,"id":7}',
  ];
  for (let i = 0; i < sources.length; i++) {
    const value = JSON.parse<TieredRecord>(sources[i]);
    expect(value.id).toBe(7);
    expect(value.name).toBe("Ada");
    expect(value.active).toBe(true);
    expect(JSON.stringify(value)).toBe('{"id":7,"name":"Ada","active":true}');
  }
});
