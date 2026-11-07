import {JSON} from "../index";
@json class Item { n:i32=0; label:string=''; values:i64[]=[]; }
@json class Owner { names:(string|null)[]|null=null; items:Item[]|null=null; tail:i32=0; }
let target:Owner|null=null;
const namesKept=new Array<Array<string|null>>();
const itemsKept=new Array<Item[]>();
const counts:i32[]=[0,1,2,8,16,17,31];
const sink=memory.data(16);
function text(turn:i32,index:i32,long:bool):string{return (long?'changed_prefix_':'')+turn.toString()+'_'+index.toString()+'x'.repeat(index&7);}
function source(turn:i32,count:i32,long:bool):string{
 let s='{"names":[';
 for(let j=0;j<count;j++){if(j)s+=',';s+=j%3==0?'null':'"'+text(turn,j,long)+'"';}
 s+='],"items":[';
 for(let j=0;j<count;j++){if(j)s+=',';s+='{"n":'+(turn*100+j).toString()+',"label":"'+text(turn,j,long)+'"}';}
 return s+'],"tail":'+turn.toString()+'}';
}
function pressure(count:i32):void{for(let n=0;n<count;n++){const v=new ArrayBuffer(73+(n&31));store<usize>(sink,changetype<usize>(v));}}
function check(names:Array<string|null>,items:Item[],turn:i32,count:i32,long:bool):void{
 assert(names.length==count&&items.length==count);
 for(let j=0;j<count;j++){
  assert(j%3==0?names[j]===null:names[j]==text(turn,j,long));
  assert(items[j].n==turn*100+j&&items[j].label==text(turn,j,long));
 }
}
export function verify():i32{
 target=new Owner();__collect();
 if(PUB_PROBE_FAST)assert(target!.__DESERIALIZE_FAST_ENABLED());
 for(let turn=0;turn<56;turn++){
  const count=counts[turn%counts.length];target!.names=null;target!.items=null;
  pressure(31+(turn&31));JSON.parse<Owner>(source(turn,count,false),target!);
  pressure(47+(turn&31));__collect();
  check(target!.names!,target!.items!,turn,count,false);
  JSON.parse<Owner>(source(turn,count,true),target!);
  pressure(59+(turn&31));__collect();
  check(target!.names!,target!.items!,turn,count,true);
  namesKept.push(target!.names!);itemsKept.push(target!.items!);
 }
 target=null;__collect();
 for(let turn=0;turn<56;turn++){
  check(namesKept[turn],itemsKept[turn],turn,counts[turn%counts.length],true);
  if(turn){assert(namesKept[turn]!==namesKept[turn-1]);assert(itemsKept[turn]!==itemsKept[turn-1]);}
 }
 return 56;
}

@lazy let finalized:i32=0;
@global function __finalize(_ptr:usize):void {finalized++;}
export function finalizedCount():i32{return finalized;}
