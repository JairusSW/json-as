let currentDescription: string = "";
export function describe(description: string, routine: () => void): void {
  currentDescription = description;
  routine();
}

export function it(description: string, routine: () => void): void {
  currentDescription = description;
  routine();
}

export function expect<T>(left: T): Expectation {
  // @ts-ignore
  if (!isDefined(left.toString)) throw new Error("Expected left to have a toString method, but it does not.");
  // @ts-ignore
  return new Expectation(isNull(left) ? "null" : left.toString());
}

class Expectation {
  public left: string;

  constructor(left: string) {
    this.left = left;
  }
  toBe<T>(right: T): void {
    // @ts-ignore
    if (!isDefined(right.toString)) throw new Error("Expected right to have a toString method, but it does not.");
    // @ts-ignore
    if (this.left != (isNull(right) ? "null" : right.toString())) {
      console.log("  " + currentDescription + "\n");
      // @ts-ignore
      console.log("  (expected) -> " + (isNull(right) ? "null" : right.toString()));
      console.log("  (received) -> " + this.left);
      unreachable();
    }
  }
}

function isNull<T>(value: T): bool {
  return (isInteger<T>() && !isSigned<T>() && nameof<T>() == "usize" && value == 0) || (isNullable<T>() && changetype<usize>(value) == <usize>0);
}
