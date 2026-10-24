import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/model.ts';
import {nativeExportReason} from '../src/native-plan.ts';
import {exportDimensions} from '../src/export-settings.ts';
const fixture=()=>({...fresh(),assets:[{id:'a',name:'photo.png',kind:'image',width:640,height:360}],clips:[{id:'c',assetId:'a',inFrame:0,frames:180,volume:1}]});
test('native accepts cuts, stills, crop, scale and placement without mutating edits',()=>{
 const p=fixture();Object.assign(p.clips[0],{crop:{x:.1,y:0,width:.8,height:1},scale:1.2,x:.4,y:.7});
 p.clips.push({...p.clips[0],id:'d'});const original=structuredClone(p);
 assert.equal(nativeExportReason(p,'mp4',()=>true),null);assert.equal(nativeExportReason(p,'mp4-hevc',()=>true),null);assert.deepEqual(p,original);
});
test('native rejects features requiring the shared compositor rather than dropping them',()=>{
 for(const edit of [{transitionFrames:30},{startTransition:{type:'dissolve',frames:30}},{endTransition:{type:'wipe-left',frames:30}},{adjustments:{brightness:10}},{opacity:.5},{track:'v2'}]){
  const p=fixture();Object.assign(p.clips[0],edit);assert.ok(nativeExportReason(p,'mp4',()=>true),JSON.stringify(edit));
 }
 const p=fixture();p.texts=[{text:'A title'}];assert.match(nativeExportReason(p,'mp4',()=>true),/Titles/);
 assert.match(nativeExportReason(fixture(),'webm',()=>true),/WebM/);
 assert.match(nativeExportReason(fixture(),'mp4',()=>false),/source access/);
 const gif=fixture();gif.assets[0].name='animated.gif';assert.match(nativeExportReason(gif,'mp4',()=>true),/still-image/);
});
test('native preserves processing on additional audio tracks but guards picture duration',()=>{
 const p=fixture();p.assets.push({id:'b',kind:'audio',name:'music.wav'});p.clips.push({id:'b',assetId:'b',inFrame:0,frames:180,volume:.7,track:'a1',startFrame:0,audio:{compressor:true,fadeIn:1}});
 assert.equal(nativeExportReason(p,'mp4',id=>id==='a'),null);p.clips[1].frames=210;
 assert.match(nativeExportReason(p,'mp4',()=>true),/audio tail/);
});
test('sharing presets halve standard bitrate and preserve high quality option',()=>{
 const options=quality=>exportDimensions(fresh(),{resolution:720,fps:30,quality});
 assert.equal(options('compact').bitrate,1200000);assert.equal(options('standard').bitrate,2000000);assert.equal(options('high').bitrate,4000000);
 assert.equal(Math.ceil((options('compact').bitrate+128000)*240/8/1000000),40);
 assert.equal(Math.ceil((options('standard').bitrate+128000)*240/8/1000000),64);
});
