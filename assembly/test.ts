import { JSON } from ".";


@json
class Point {
  x: f64 = 0.0;
  y: f64 = 0.0;
  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }
}


@json
class UseStdTest {
  strCount: Map<string, i32>;
  pointCount: Map<Point, i32>;
  val: i64;
  constructor() {
    this.strCount = new Map();
    this.val = 233;
    this.pointCount = new Map();
  }

  recordStr(s: string): void {
    if (!this.strCount.has(s)) this.strCount.set(s, 1);
    else this.strCount.set(s, this.strCount.get(s) + 1);
  }
  recordPoint(p: Point): void {
    if (!this.pointCount.has(p)) this.pointCount.set(p, 1);
    else this.pointCount.set(p, this.pointCount.get(p) + 1);
  }
}

const usestd = new UseStdTest();
usestd.recordStr("hello");
usestd.recordStr("world");
const p1 = new Point(1.414, 3.14);
usestd.recordPoint(p1);
const s: string = JSON.stringify(usestd);
console.log(s);

const expected: UseStdTest = JSON.parse<UseStdTest>(s);
const correct = JSON.stringify(usestd) === JSON.stringify(expected);
console.log(correct.toString());
