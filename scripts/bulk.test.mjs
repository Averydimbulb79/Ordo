import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,placements,History,parseProject} from '../src/model.ts';
import {appendMedia,setTransitions,setAdjustments} from '../src/bulk.ts';
const video={id:'v',name:'v.webm',size:1,modified:0,duration:3,kind:'video',width:320,height:180};
const audio={...video,id:'a',name:'a.wav',kind:'audio',width:0,height:0};
test('bulk media preserves bin order, appends without collisions and undoes as one action',()=>{
 const base={...fresh(),assets:[video,audio,{...video,id:'v2'}]};let n=0;
 const p=appendMedia(base,['v','a','v2'],'v2','a2',30,()=>String(++n));
 assert.deepEqual(p.clips.map(c=>c.assetId),['v','a','v2']);
 assert.deepEqual(placements(p).map(e=>[e.track,e.start,e.end]),[['v2',30,120],['a2',30,120],['v2',120,210]]);
 assert.ok(p.clips.filter(c=>c.track==='v2').every(c=>c.scale===.4));
 const h=new History();h.push(base);assert.deepEqual(h.undo(p),base);assert.deepEqual(h.redo(base),p);
 assert.equal(base.clips.length,0);assert.deepEqual(parseProject(JSON.stringify(p)),p);
});
test('bulk transitions clamp short joins and leave overlays and last clip unchanged',()=>{
 const clips=[30,4,1].map((frames,i)=>({id:String(i),assetId:'v',inFrame:0,frames,volume:1}));
 const base={...fresh(),assets:[video],clips:[...clips,{...clips[0],id:'overlay',track:'v2',startFrame:0}]};
 const p=setTransitions(base,base.clips.map(c=>c.id),'wipe-left',60);
 assert.equal(p.clips[0].transitionFrames,2);assert.equal(p.clips[1].transitionFrames,0);assert.equal(p.clips[1].transition,undefined);
 assert.deepEqual(p.clips.slice(2),base.clips.slice(2));assert.deepEqual(setTransitions(p,['0'],'cut',15).clips[0],{...clips[0],transitionFrames:0});
 assert.equal(base.clips[0].transition,undefined);
});
test('bulk grade replaces video grades, retains geometry and excludes audio tracks',()=>{
 const c={id:'0',assetId:'v',inFrame:0,frames:30,volume:.4,crop:{x:.1,y:.1,width:.8,height:.8},scale:.4,transition:'dissolve',transitionFrames:5,adjustments:{contrast:10}};
 const base={...fresh(),assets:[video,audio],clips:[c,{...c,id:'1',track:'v2',startFrame:0},{...c,id:'2',track:'a1',startFrame:0},{...c,id:'3',assetId:'a',track:'a2',startFrame:0}]};
 const p=setAdjustments(base,base.clips.map(c=>c.id),{saturation:-100});
 for(const i of [0,1])assert.deepEqual(p.clips[i],{...base.clips[i],adjustments:{saturation:-100}});
 assert.deepEqual(p.clips.slice(2),base.clips.slice(2));assert.deepEqual(base.clips[0].adjustments,{contrast:10});
 p.clips[0].adjustments.saturation=50;assert.equal(p.clips[1].adjustments.saturation,-100);
});
