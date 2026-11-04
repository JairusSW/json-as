import { JSON } from "../..";

@json class Hidden<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

@json export class Base<T> {
  value: Hidden<T> = new Hidden<T>(changetype<T>(0));
}
