import { JSON } from ".";


@json
export class GenericEnum<T> {
  private tag: string = "";
  private value: T | null = null;

  constructor() {
    this.tag = "";
    this.value = null;
  }

  static create<T>(tag: string, value: T): GenericEnum<T> {
    const item = new GenericEnum<T>();
    item.tag = tag;
    item.value = value;
    return item;
  }

  getTag(): string {
    return this.tag;
  }

  getValue(): T | null {
    return this.value;
  }


  @serializer
  serialize<T>(self: GenericEnum<T>): string {
    const tagJson = JSON.stringify(self.tag);
    const valueJson = JSON.stringify(self.value);
    return `{${tagJson}:${valueJson}}`;
  }


  @deserializer
  deserialize(data: string): GenericEnum<T> {
    const parsed = JSON.parse<Map<string, JSON.Raw>>(data);
    const result = new GenericEnum<T>();

    const keys = parsed.keys();
    const values = parsed.values();

    result.tag = keys[0];
    result.value = JSON.parse<T>(values[0].data);

    return result;
  }
}


@json
export class Node<T> {
  name: string;
  id: u32;
  data: T;

  constructor() {
    this.name = "";
    this.id = 0;
    this.data = changetype<T>(0);
  }
}


@json
export class Vec3 {
  x: f32 = 0.0;
  y: f32 = 0.0;
  z: f32 = 0.0;
}


@json
export class Point {}
