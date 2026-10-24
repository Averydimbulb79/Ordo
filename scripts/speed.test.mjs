import {test} from 'node:test';import assert from 'node:assert/strict';
import {fresh,parseProject,placements,duration,sourceAt,sourceSpan,split,trim} from '../src/model.ts';
import {setClipSpeed} from '../src/clip-speed.ts';
const asset=(id,kind='video')=>({id,name:id+'.mp4',kind,size:1,modified:0,duration:10,width:320,height:180});
const fixture=()=>({...fresh(),assets:[asset('v'),asset('a','audio'),asset('i','image')],clips:[{id:'v',assetId:'v',inFrame:30,frames:90,volume:1},{id:'w',assetId:'v',inFrame:0,frames:90,volume:1},{id:'a',assetId:'a',inFrame:0,frames:90,volume:.6,track:'a1',startFrame:0,audio:{gainDb:3}},{id:'b',assetId:'a',inFrame:0,frames:90,volume:1,track:'a1',startFrame:90},{id:'i',assetId:'i',inFrame:0,frames:90,volume:0}]});
test('speed preserves exact source range, duration and settings across save/reopen',()=>{
 const original=fixture(),p=setClipSpeed(original,'v',2);assert.equal(p.clips[0].frames,45);assert.equal(sourceSpan(p.clips[0]),90);assert.equal(sourceAt(p.clips[0],15),60);assert.equal(p.clips[0].inFrame,30);assert.equal(placements(p)[1].start,45);assert.equal(placements(original)[1].start,90);assert.deepEqual(parseProject(JSON.stringify(p)),p);assert.equal(duration(setClipSpeed(p,'v',1)),270);
});
test('ripple off preserves downstream positions with gaps and rejects slowing collisions atomically',()=>{
 const p=setClipSpeed(fixture(),'v',2,true,false);assert.equal(placements(p)[1].start,90);assert.equal(p.clips[1].startFrame,90);assert.throws(()=>setClipSpeed(p,'v',.5,true,false),/overlap/);assert.equal(p.clips[0].speed,2);
});
test('bulk speed is scoped by asset kind and ripples only affected lanes',()=>{
 const p=setClipSpeed(fixture(),'a',2,false,true,true);assert.equal(p.clips[2].frames,45);assert.equal(p.clips[3].startFrame,45);assert.deepEqual(p.clips[2].audio,{gainDb:3});assert.equal(p.clips[2].volume,.6);assert.equal(p.clips[2].preservePitch,false);assert.equal(p.clips[0].speed,undefined);assert.equal(p.clips[4].frames,90);
});
test('fractional rate maps the exact range to whole timeline frames and splits contiguously',()=>{
 const p=fixture();p.clips[0].frames=37;const fast=setClipSpeed(p,'v',1.5);assert.equal(fast.clips[0].frames,25);const cut=split(fast,'v',13,'right');assert.equal(cut.clips[0].frames+cut.clips[1].frames,25);assert.equal(cut.clips[1].inFrame,30+sourceSpan(cut.clips[0]));assert.ok(Math.abs(sourceSpan(cut.clips[0])+sourceSpan(cut.clips[1])-37)<1e-9);assert.deepEqual(parseProject(JSON.stringify(cut)),JSON.parse(JSON.stringify(cut)));
 const trimmed=trim(fast,'v',30,60);assert.equal(trimmed.clips[0].frames,20);assert.equal(sourceSpan(trimmed.clips[0]),30);
});
test('normal trimming still ripples after speed, invalid speed data and images are rejected',()=>{
 const p=setClipSpeed(fixture(),'v',2);const short=trim(p,'v',30,90);assert.equal(placements(short)[1].start,30);for(const n of [0,.1,5,NaN,Infinity])assert.throws(()=>setClipSpeed(p,'v',n));assert.throws(()=>setClipSpeed(p,'i',2));
 for(const edit of [{speed:0},{speed:5},{preservePitch:'yes'},{sourceFrames:-1},{sourceFrames:15}]){const invalid=fixture();Object.assign(invalid.clips[0],edit);assert.throws(()=>parseProject(JSON.stringify(invalid)));}
});
