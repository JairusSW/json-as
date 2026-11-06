import { JSON } from "../index";
let narrow: JSON.Value = JSON.Value.empty();
let floating: JSON.Value = JSON.Value.empty();
let wide: JSON.Value = JSON.Value.empty();
export function setup(n:i32):void {
 narrow=JSON.Value.from<i32>(n);floating=JSON.Value.from<f64>(<f64>n+0.5);
 wide=JSON.Value.from<i64>(<i64>n+9007199254740993);
}
export function ints(n:i32):i32 {let sum:i32=0;for(let i=0;i<n;i++)sum+=narrow.get<i32>();return sum;}
export function floats(n:i32):f64 {let sum:f64=0;for(let i=0;i<n;i++)sum+=floating.get<f64>();return sum;}
export function wides(n:i32):i64 {let sum:i64=0;for(let i=0;i<n;i++)sum+=wide.get<i64>();return sum;}
export function convert(n:i32):i32 {let sum:i32=0;for(let i=0;i<n;i++)sum+=floating.get<i32>();return sum;}

export function invalid(): i32 { return JSON.Value.from<string>("7").get<i32>(); }
