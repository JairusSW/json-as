@json
export default class Point {
  value: i32 = 7;
  @serializer("number") encode(self: Point): string {
    return self.value.toString();
  }
}
