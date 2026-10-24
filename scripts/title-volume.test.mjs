import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,parseProject} from '../src/model.ts';
import {newText} from '../src/creative-model.ts';
import {setSourceVolume} from '../src/source-volume.ts';
test('text opacity and independent start/end effects survive project save and reopen',()=>{
 const p=fresh();p.texts=[{...newText('title',0),opacity:0,startTransition:{type:'dissolve',frames:15},endTransition:{type:'wipe-left',frames:30},rotation:45,x:.2,y:.7}];
 assert.deepEqual(parseProject(JSON.stringify(p)),p);
 for(const value of [-.1,1.1,null,'0.5'])assert.throws(()=>parseProject(JSON.stringify({...p,texts:[{...p.texts[0],opacity:value}]})));
 for(const edge of [{type:'bogus',frames:15},{type:'dissolve',frames:0},{type:'dissolve',frames:301}])assert.throws(()=>parseProject(JSON.stringify({...p,texts:[{...p.texts[0],startTransition:edge}]})));
});
test('bulk source volume separates original video sound from imported audio and preserves processing',()=>{
 const p={...fresh(),assets:[{id:'v',kind:'video'},{id:'a',kind:'audio'},{id:'i',kind:'image'}],clips:[{id:'v1',assetId:'v',volume:1,audio:{gainDb:3}},{id:'v2',assetId:'v',volume:.4,track:'v2'},{id:'a1',assetId:'a',volume:.8,track:'a1',audio:{fadeIn:2}},{id:'i1',assetId:'i',volume:1}]};
 const q=setSourceVolume(p,'v1',.25,true);assert.deepEqual(q.clips.map(c=>c.volume),[.25,.25,.8,1]);assert.equal(q.clips[0].audio.gainDb,3);assert.equal(p.clips[0].volume,1);
 assert.deepEqual(setSourceVolume(q,'a1',0,true).clips.map(c=>c.volume),[.25,.25,0,1]);assert.equal(setSourceVolume(p,'a1',.2).clips[2].audio.fadeIn,2);
 assert.throws(()=>setSourceVolume(p,'i1',.5,true));assert.throws(()=>setSourceVolume(p,'v1',1.1,true));
});
