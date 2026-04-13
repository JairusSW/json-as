export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonTypeKind = "unknown" | "null" | "bool" | "number" | "string" | "array" | "object" | "value";

export interface InferOptions {
  rootName?: string;
  strict?: boolean;
  dedupe?: boolean;
  preferF64?: boolean;
  preferI64?: boolean;
}

export interface EmitOptions {
  rootName?: string;
  header?: boolean;
}

export interface SchemaWarning {
  path: string;
  message: string;
}

export interface InferredSchema {
  root: TypeNode;
  classes: ClassNode[];
  warnings: SchemaWarning[];
  options: Required<InferOptions>;
}

export interface FieldNode {
  jsonKey: string;
  name: string;
  type: TypeNode;
  seen: number;
  nullable: boolean;
  optional: boolean;
}

export interface ClassNode {
  name: string;
  path: string;
  fields: FieldNode[];
}

export type NumberKind = "i32" | "i64" | "f64";

export type TypeNode =
  | { kind: "unknown" }
  | { kind: "null" }
  | { kind: "bool" }
  | { kind: "number"; numberKind: NumberKind }
  | { kind: "string" }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; className: string; classNode: ClassNode }
  | { kind: "value" };
