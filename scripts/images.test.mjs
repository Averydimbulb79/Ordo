import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,trim,split,parseProject,duration,placements} from '../src/model.ts';
import {appendMedia,setEdgeTransitions,setTransitions,setAdjustments} from '../src/bulk.ts';
import {FONT_NAMES,newText} from '../src/creative-model.ts';
const image={id:'i',name:'photo.png',size:20,modified:0,duration:6,kind:'image',width:640,height:360};
const fixture=()=>appendMedia({...fresh(),assets:[image]},['i'],'v1','a1',0,()=> 'c');
test('images start at six seconds and can extend beyond their default duration',()=>{
 const p=fixture();assert.equal(p.clips[0].frames,180);assert.equal(duration(p),180);
 const q=trim(p,'c',0,450);assert.equal(duration(q),450);assert.equal(p.clips[0].frames,180);
 const short=trim(q,'c',30,60);assert.equal(duration(short),30);assert.deepEqual(parseProject(JSON.stringify(q)),q);
 assert.throws(()=>trim(q,'c',0,86400*30+1));assert.throws(()=>trim(q,'c',20,20));
});
test('images share adjustments, transforms, crop, joins and independent edge animations',()=>{
 let p=fixture();p=appendMedia(p,['i'],'v1','a1',0,()=> 'd');p=setAdjustments(p,['c','d'],{contrast:20});
 p.clips[0].crop={x:.1,y:0,width:.8,height:1};p.clips[0].scale=.8;
 p=setEdgeTransitions(p,['c','d'],'start','wipe-left',30);p=setEdgeTransitions(p,['c'],'end','dissolve',60);p=setTransitions(p,['c'],'zoom-in',15);
 assert.equal(duration(p),345);assert.deepEqual(placements(p).map(e=>e.start),[0,165]);assert.deepEqual(parseProject(JSON.stringify(p)),p);
 const q=split(p,'c',90,'right');assert.equal(q.clips[0].endTransition,undefined);assert.equal(q.clips[1].startTransition,undefined);assert.equal(q.clips[1].endTransition.type,'dissolve');
 const cleared=setEdgeTransitions(p,['c'],'start','cut',30);assert.equal(cleared.clips[0].startTransition,undefined);assert.equal(cleared.clips[1].startTransition.type,'wipe-left');
 for(const edge of [{type:'bogus',frames:3},{type:'dissolve',frames:301},{type:'dissolve',frames:0}])assert.throws(()=>parseProject(JSON.stringify({...p,clips:[{...p.clips[0],startTransition:edge}]})));
});
test('66 unique fonts round trip for titles and captions; earlier projects migrate to v5',()=>{
 assert.equal(FONT_NAMES.length,66);assert.equal(new Set(FONT_NAMES).size,66);
 const p=fixture();p.texts=FONT_NAMES.flatMap((fontFamily,i)=>['title','caption'].map(kind=>({...newText(kind,i*30),fontFamily})));
 assert.deepEqual(parseProject(JSON.stringify(p)),p);for(const version of [1,2,3,4])assert.equal(parseProject(JSON.stringify({...fresh(),version})).version,5);
});
