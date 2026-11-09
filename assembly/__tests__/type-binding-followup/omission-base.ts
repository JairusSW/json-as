export class Base<T> {

  @omitif((self: Base<T>) => isInteger<T>())
  value!: T;
}
export class Middle<U> extends Base<U> {}
