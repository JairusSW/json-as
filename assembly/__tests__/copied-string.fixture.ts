import {JSON} from '../index';
import {canAllocateCopiedString} from '../util/runtime';
export function copyEnabled():bool{return canAllocateCopiedString();}
@json class Row { a:string=''; b:string|null=null; }
let kept:Row[]|null=null;
export function stringId():u32{return idof<string>();}
export function verify(source:string,collect:bool):string {
 kept=JSON.parse<Row[]>(source);
 for(let i=0;i<16;i++){const next=JSON.parse<Row[]>(source);assert(next.length==kept!.length);}
 if(collect)__collect();return JSON.stringify(kept!);
}
