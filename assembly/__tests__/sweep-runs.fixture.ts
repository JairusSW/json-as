import {JSON} from "../index";
@json class Row { n:i32=0; labels:string[]=[]; }
@json class Root { rows:Row[]=[]; }
const source='{"rows":[{"n":7,"labels":["alpha","beta"]},{"n":8,"labels":["gamma","delta"]},{"n":9,"labels":[]},{"n":10,"labels":["epsilon"]}]}';
let first:Root|null=null;
let last:Root|null=null;
function check(value:Root):void{assert(value.rows.length==4&&value.rows[0].n==7&&value.rows[3].n==10);assert(value.rows[0].labels[0]=='alpha'&&value.rows[1].labels[1]=='delta'&&value.rows[2].labels.length==0&&value.rows[3].labels[0]=='epsilon');}
export function verify():i32{
 first=JSON.parse<Root>(source);__collect();
 for(let i=0;i<5000;i++){last=JSON.parse<Root>(source);if((i&127)==0)__collect();}
 __collect();check(first!);check(last!);
 assert(first!==last&&first!.rows!==last!.rows&&first!.rows[0]!==last!.rows[0]&&first!.rows[0].labels!==last!.rows[0].labels);
 return 1;
}
