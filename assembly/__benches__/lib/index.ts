export function describe(description: string, routine: () => void): void {
  routine();
}

export function it(description: string, routine: () => void): void {
  routine();
}

export function expect(left: string): Expectation {
  return new Expectation(left);
}

class Expectation {
  public left: string;

  constructor(left: string) {
    this.left = left;
  }
  toBe(right: string): void {
    if (this.left != right) {
      console.log("  (expected) -> " + right);
      console.log("  (received) -> " + this.left);
      process.exit(1);
    }
  }
}
