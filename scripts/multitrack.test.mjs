import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,placements,layersAt,duration,split,parseProject,validateTracks} from '../src/model.ts';
const asset={id:'a',name:'clip.webm',size:100,modified:1,duration:10,kind:'video',width:320,height:180};
const clip=(id,extra={})=>({id,assetId:'a',inFrame:0,frames:60,volume:1,...extra});
test('dissolve overlaps adjacent main clips and weights both pictures and sound',()=>{
 const p={...fresh(),assets:[asset],clips:[clip('one',{transitionFrames:30}),clip('two')]};
 assert.deepEqual(placements(p).map(e=>[e.start,e.end]),[[0,60],[30,90]]);
 assert.equal(duration(p),90);assert.deepEqual(layersAt(p,45).map(e=>e.weight),[.5,.5]);
 assert.equal(layersAt(p,0).length,1);assert.equal(layersAt(p,90).length,0);
});
test('overlays and audio have independent starts and extend sequence duration',()=>{
 const p={...fresh(),assets:[asset],clips:[clip('main'),clip('overlay',{track:'v2',startFrame:30}),clip('sound',{track:'a1',startFrame:120})]};
 assert.equal(duration(p),180);assert.deepEqual(layersAt(p,45).map(e=>e.track),['v1','v2']);assert.equal(layersAt(p,100).length,0);
 const q=split(p,'overlay',60,'right');assert.deepEqual(placements(q).filter(e=>e.track==='v2').map(e=>[e.start,e.end]),[[30,60],[60,90]]);assert.equal(duration(q),180);
});
test('collisions within an independent track are rejected',()=>{
 const p={...fresh(),assets:[asset],clips:[clip('a',{track:'a1',startFrame:0}),clip('b',{track:'a1',startFrame:30})]};
 assert.throws(()=>validateTracks(p),/overlap/);p.clips[1].track='a2';assert.doesNotThrow(()=>validateTracks(p));
});
test('version one projects migrate and multitrack settings round trip',()=>{
 const p={...fresh(),assets:[asset],clips:[clip('a')]};
 assert.deepEqual(parseProject(JSON.stringify({...p,version:1})),p);
 p.clips.push(clip('b',{track:'v2',startFrame:15,scale:.4,x:.75,y:.75,opacity:.8}));assert.deepEqual(parseProject(JSON.stringify(p)),p);
 for(const extra of [{track:'invalid'},{startFrame:-1},{opacity:2},{scale:0},{transitionFrames:90}])assert.throws(()=>parseProject(JSON.stringify({...p,clips:[clip('bad',extra)]})));
});
