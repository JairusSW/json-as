import { JSON } from ".";


@json
class Example {
  constructor(
    public a: string,
    public b: string,
    public c: string,
    public d: string,
    public e: boolean,
  ) {}
}

const good = `{"a":"a","b":"b","e":true,"c":"c","d":"d"}`;
const good2 = `{"a":"a","b":"b","c":"c","d":"d","e":false}`;
const bad = `{"a":"a","b":"b","e":false,"c":"c","d":"d"}`;
const parsedGood = JSON.parse<Example>(good);
console.log("a: " + JSON.stringify(parsedGood));
const parsedGood2 = JSON.parse<Example>(good2);
console.log("b: " + JSON.stringify(parsedGood2));
const parsedBad = JSON.parse<Example>(bad);
console.log("c: " + JSON.stringify(parsedBad));

console.log(load<u64>(changetype<usize>("alse")).toString());
