import {sha256} from '@noble/hashes/sha2.js';
import type {Asset} from './model.ts';
export async function fileHash(file:Blob){const hash=sha256.create();const reader=file.stream().getReader();let count=0;try{while(true){const {done,value}=await reader.read();if(done)break;hash.update(value);if(++count%16===0)await new Promise(r=>setTimeout(r,0));}return Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');}finally{reader.releaseLock();}}
export function sameSource(expected:Asset,actual:Asset){
 if(expected.sha256)return expected.sha256===actual.sha256;
 return expected.name===actual.name&&expected.size===actual.size&&expected.kind===actual.kind&&expected.width===actual.width&&expected.height===actual.height&&Math.abs(expected.duration-actual.duration)<=1/30;
}
export function relinkCandidates(assets:Asset[],actual:Asset){
 const exact=assets.filter(a=>a.sha256&&sameSource(a,actual));if(exact.length)return exact;
 const legacy=assets.filter(a=>!a.sha256&&sameSource(a,actual));return legacy.length===1?legacy:[];
}
