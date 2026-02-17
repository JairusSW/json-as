
@json
export class ObjWithString {
  s!: string;
}


@json
export class ObjWithStrangeKey<T> {

  @alias('a\\\t"\x02b`c')
  data!: T;
}


@json
export class ObjectWithStringArray {
  sa!: string[];
}


@json
export class ObjectWithFloat {
  f!: f64;
}


@json
export class ObjectWithFloatArray {
  fa!: f64[];
}


@json
export class BaseObject {
  a: string;
  constructor(a: string) {
    this.a = a;
  }
}


@json
export class DerivedObject extends BaseObject {
  b: string;
  constructor(a: string, b: string) {
    super(a);
    this.b = b;
  }
}


@json
export class Map4 {
  a!: string;
  b!: string;
  c!: string;
  d!: string;
}


@json
export class Vec3 {
  x: f64 = 1.0;
  y: f64 = 2.0;
  z: f64 = 3.0;

  static shouldIgnore: string = "should not be serialized";
}


@json
export class Player {
  firstName!: string;
  lastName!: string;
  lastActive!: i32[];
  age!: i32;
  pos!: Vec3 | null;
  isVerified!: boolean;
}

export class Nullable {}
export type Null = Nullable | null;


@json
export class OmitIf {
  x: i32 = 1;


  @omitif("this.y == -1")
  y: i32 = -1;
  z: i32 = 1;


  @omitnull()
  foo: string | null = null;
}
