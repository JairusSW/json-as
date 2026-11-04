import { JSON } from "../..";
namespace Model {

  @json export class Token {
    value: i32 = 7;


    @serializer("number") encode(self: Model.Token): string {
      return self.value.toString();
    }
  }
}
export function run(): string {
  return JSON.stringify(new Model.Token());
}
