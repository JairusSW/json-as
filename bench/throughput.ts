import { bench, blackbox, dumpToFile } from "./lib/bench";

const objSmall = { a: 1 };
const objMedium = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
const objLarge = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, i]));

const arrSmall = [1, 2, 3];
const arrMedium = Array.from({ length: 100 }, (_, i) => i);
const arrLarge = Array.from({ length: 1000 }, (_, i) => i);

const strSmall = 'abc';
const strMedium = 'abcdefghijklmnopqrstuvwxyz'.repeat(10);
const strLarge = 'abcdefghijklmnopqrstuvwxyz'.repeat(100);

const ITERATIONS = 1_000_000;

const objSmallStr = JSON.stringify(objSmall);
const objMediumStr = JSON.stringify(objMedium);
const objLargeStr = JSON.stringify(objLarge);

const arrSmallStr = JSON.stringify(arrSmall);
const arrMediumStr = JSON.stringify(arrMedium);
const arrLargeStr = JSON.stringify(arrLarge);

const strSmallStr = JSON.stringify(strSmall);
const strMediumStr = JSON.stringify(strMedium);
const strLargeStr = JSON.stringify(strLarge);

// Objects
bench('Serialize Small Object', () => blackbox(JSON.stringify(objSmall)), ITERATIONS, objSmallStr.length << 1);
dumpToFile('small-obj', 'serialize');

bench('Serialize Medium Object', () => blackbox(JSON.stringify(objMedium)), ITERATIONS, objMediumStr.length << 1);
dumpToFile('medium-obj', 'serialize');

bench('Serialize Large Object', () => blackbox(JSON.stringify(objLarge)), ITERATIONS, objLargeStr.length << 1);
dumpToFile('large-obj', 'serialize');

// Arrays
bench('Serialize Small Array', () => blackbox(JSON.stringify(arrSmall)), ITERATIONS, arrSmallStr.length << 1);
dumpToFile('small-arr', 'serialize');

bench('Serialize Medium Array', () => blackbox(JSON.stringify(arrMedium)), ITERATIONS, arrMediumStr.length << 1);
dumpToFile('medium-arr', 'serialize');

bench('Serialize Large Array', () => blackbox(JSON.stringify(arrLarge)), ITERATIONS, arrLargeStr.length << 1);
dumpToFile('large-arr', 'serialize');

// Strings
bench('Serialize Small String', () => blackbox(JSON.stringify(strSmall)), ITERATIONS, strSmallStr.length << 1);
dumpToFile('small-str', 'serialize');

bench('Serialize Medium String', () => blackbox(JSON.stringify(strMedium)), ITERATIONS, strMediumStr.length << 1);
dumpToFile('medium-str', 'serialize');

bench('Serialize Large String', () => blackbox(JSON.stringify(strLarge)), ITERATIONS, strLargeStr.length << 1);
dumpToFile('large-str', 'serialize');

// Objects
bench('Deserialize Small Object', () => blackbox(JSON.parse(objSmallStr)), ITERATIONS, objSmallStr.length << 1);
dumpToFile('small-obj', 'deserialize');

bench('Deserialize Medium Object', () => blackbox(JSON.parse(objMediumStr)), ITERATIONS, objMediumStr.length << 1);
dumpToFile('medium-obj', 'deserialize');

bench('Deserialize Large Object', () => blackbox(JSON.parse(objLargeStr)), ITERATIONS, objLargeStr.length << 1);
dumpToFile('large-obj', 'deserialize');

// Arrays
bench('Deserialize Small Array', () => blackbox(JSON.parse(arrSmallStr)), ITERATIONS, arrSmallStr.length << 1);
dumpToFile('small-arr', 'deserialize');

bench('Deserialize Medium Array', () => blackbox(JSON.parse(arrMediumStr)), ITERATIONS, arrMediumStr.length << 1);
dumpToFile('medium-arr', 'deserialize');

bench('Deserialize Large Array', () => blackbox(JSON.parse(arrLargeStr)), ITERATIONS, arrLargeStr.length << 1);
dumpToFile('large-arr', 'deserialize');

// Strings
bench('Deserialize Small String', () => blackbox(JSON.parse(strSmallStr)), ITERATIONS, strSmallStr.length << 1);
dumpToFile('small-str', 'deserialize');

bench('Deserialize Medium String', () => blackbox(JSON.parse(strMediumStr)), ITERATIONS, strMediumStr.length << 1);
dumpToFile('medium-str', 'deserialize');

bench('Deserialize Large String', () => blackbox(JSON.parse(strLargeStr)), ITERATIONS, strLargeStr.length << 1);
dumpToFile('large-str', 'deserialize');
