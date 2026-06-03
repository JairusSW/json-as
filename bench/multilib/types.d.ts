declare module "fast-json-parse" {
  export default function parseFast<T = unknown>(
    input: string,
  ): {
    value: T;
    err: Error | null;
  };
}
