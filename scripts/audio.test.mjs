import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,parseProject,placements,layersAt,validateTracks,split,trim,History} from '../src/model.ts';
import {crossfadeAudio,edgeFades,copyAudio,disconnectAudioJoins} from '../src/audio-model.ts';
import {fileHash,sameSource,relinkCandidates} from '../src/media-identity.ts';
const asset={id:'a',name:'sound.mp3',size:100,modified:0,duration:3,kind:'audio',width:0,height:0};
const fixture=()=>({...fresh(),assets:[asset],clips:[{id:'a',assetId:'a',inFrame:0,frames:90,volume:1,track:'a1',startFrame:0},{id:'b',assetId:'a',inFrame:0,frames:90,volume:1,track:'a1',startFrame:90},{id:'c',assetId:'a',inFrame:0,frames:90,volume:1,track:'a1',startFrame:180}]});
test('audio crossfades use equal-power envelopes and keep video and other audio tracks fixed',()=>{
 const p=fixture();p.clips.push({...p.clips[0],id:'other',track:'a2',startFrame:200});
 const q=crossfadeAudio(p,'a1',['a','b'],30);validateTracks(q);
 assert.deepEqual(placements(q).filter(e=>e.track==='a1').map(e=>[e.start,e.end]),[[0,90],[60,150],[120,210]]);
 const mid=layersAt(q,75).filter(e=>e.track==='a1');assert.ok(mid.every(e=>Math.abs(e.audioWeight-Math.SQRT1_2)<1e-6));assert.ok(Math.abs(mid.reduce((n,e)=>n+e.audioWeight**2,0)-1)<1e-6);
 assert.equal(q.clips[3].startFrame,200);assert.equal(p.clips[1].startFrame,90);
 assert.deepEqual(crossfadeAudio(q,'a1',['a','b'],0),p);
 const h=new History();h.push(p);assert.deepEqual(h.undo(q),p);
});
test('first/last fades preserve the middle clip and round-trip with audio processing',()=>{
 const p=edgeFades(fixture(),'a1',1,2);assert.equal(layersAt(p,15)[0].audioWeight,.5);assert.equal(layersAt(p,255)[0].audioWeight,.25);assert.equal(p.clips[1].audio,undefined);
 const q=copyAudio(p,['a'],{gainDb:6,pan:-.7,bass:4,compressor:true,threshold:-24,ratio:6,attack:10,release:180,limiter:true,fadeIn:1});
 assert.deepEqual(parseProject(JSON.stringify(q)),q);assert.deepEqual(parseProject(JSON.stringify({...fixture(),version:3})),fixture());
 assert.throws(()=>parseProject(JSON.stringify({...p,clips:[{...p.clips[0],audio:{gainDb:100}}]})));
});
test('crossfades clamp short clips, preserve gaps and reject accidental or triple overlaps',()=>{
 const p=fixture();p.clips[0].frames=6;p.clips[1].startFrame=6;p.clips[2].startFrame=96;
 const q=crossfadeAudio(p,'a1',['a'],300);assert.equal(q.clips[0].audioCrossfadeFrames,3);validateTracks(q);
 p.clips[1].startFrame=30;p.clips[2].startFrame=120;assert.throws(()=>crossfadeAudio(p,'a1',['a'],10),/together/);
 const gapped=crossfadeAudio(p,'a1',['a','b'],10);assert.equal(gapped.clips[1].startFrame,30);validateTracks(gapped);const fades=edgeFades(crossfadeAudio(p,'a1',['a'],0),'a1',.5,1);validateTracks(fades);assert.equal(fades.clips[1].startFrame,30);assert.equal(fades.clips[0].audio.fadeIn,.2);assert.equal(fades.clips[2].audio.fadeOut,1);
 const bad=fixture();bad.clips[1].startFrame=10;assert.throws(()=>validateTracks(bad),/overlap/);
 const linked=crossfadeAudio(fixture(),'a1',['a','b'],30);const removed=disconnectAudioJoins(linked,'b');removed.clips=removed.clips.filter(c=>c.id!=='b');validateTracks(removed);assert.equal(removed.clips.find(c=>c.id==='c').startFrame,120,'Removing a clip preserves the other independent start times');
 const cut=split(linked,'b',105,'new');validateTracks(cut);assert.equal(cut.clips.find(c=>c.id==='new').audioCrossfadeFrames,30);
 const shortened=trim(linked,'b',0,60);validateTracks(shortened);assert.equal(shortened.clips.find(c=>c.id==='c').startFrame,90);
});
test('full content fingerprints reconnect renamed files and reject same-name same-size impostors',async()=>{
 const a=new File(['abc'],'sound.mp3'),b=new File(['abd'],'sound.mp3'),renamed=new File(['abc'],'renamed.mp3');
 const sha=await fileHash(a);assert.equal(sha,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.equal(await fileHash(renamed),sha);assert.notEqual(await fileHash(b),sha);
 const expected={...asset,sha256:sha},actual={...asset,name:renamed.name,sha256:await fileHash(renamed)};
 assert.ok(sameSource(expected,actual));assert.equal(relinkCandidates([expected],{...asset,sha256:await fileHash(b)}).length,0);
 assert.equal(relinkCandidates([asset,{...asset,id:'ambiguous'}],{...asset,sha256:sha}).length,0);
 assert.deepEqual(parseProject(JSON.stringify({...fixture(),assets:[expected]})).assets[0],expected);
});
