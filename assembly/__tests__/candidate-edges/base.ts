function omitted(_self: Base): bool {
  return true;
}
const OMIT: bool = true;
export class Base {

  @omitif(omitted) value: i32 = 7;


  @omitif("OMIT") count: i32 = 8;
}

export class ArrowBase {

  @omitif((self) => self.hidden == 7) hidden: i32 = 7;

  @omitif(() => true) zero: i32 = 8;

  @omitif('this.label == "skip"') label: string = "skip";
}
