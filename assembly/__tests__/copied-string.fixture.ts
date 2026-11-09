// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

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
