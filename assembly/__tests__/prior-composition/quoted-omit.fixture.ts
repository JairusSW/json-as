import { JSON } from "../..";

@json class Owner {
  label: string = "visible";

  @omitif('this.label == "hidden"') value: i32 = 7;
}
export function run(): string {
  return JSON.stringify(new Owner());
}
