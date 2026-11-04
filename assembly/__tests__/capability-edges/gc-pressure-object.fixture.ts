import { JSON } from "../..";
class Values extends Array<JSON.Value> {}
function source(): JSON.Value[] {
  return [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
}
export function run(append: bool): string {
  __collect();
  const object = new JSON.Obj();
  if (append) {
    const key = "key";
    object.appendRaw(
      changetype<usize>(key),
      changetype<usize>(key) + 6,
      source(),
    );
  } else object.set("key", source());
  return JSON.stringify(object.getAs<Values>("key"));
}
