import { JSON } from "..";


@json
class Data {
  id: string = "";
  active: bool = false;
}

export function test(): void {
  const d = new Data();
  d.id = "second";
  d.active = true;
  const result = JSON.stringify<Data>(d);
  assert(
    result == '{"id":"second","active":true}',
    "Serialization B failed: " + result,
  );
}
