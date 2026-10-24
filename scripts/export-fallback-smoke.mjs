// Exercise real encoded output while forcing each failure handled by the preview decoder.
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const folder=await mkdtemp(join(tmpdir(),'ordo-fallback-'));
let browser,server;
try{
 const fixture=join(folder,'changing.webm');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=160x90:r=30:d=0.5','-f','lavfi','-i','color=blue:s=160x90:r=30:d=0.5','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a','-c:v','libvpx','-c:a','libopus',fixture]);
 server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 const url=server.resolvedUrls.local[0];
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage();
 // Inject decoder faults into the actual export module, without shipping a test switch in the app.
 await page.route('**/src/export.ts',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text()).replace('if (canReadNativeFrames(local.file))',"if (globalThis.decoderFault === 'native' || canReadNativeFrames(local.file))")+`
   const originalCanvases=CanvasSink.prototype.canvasesAtTimestamps;
   CanvasSink.prototype.canvasesAtTimestamps=async function*(timestamps){
    let count=0;
    for await(const canvas of originalCanvases.call(this,timestamps)){
     if(++count===6&&globalThis.decoderFault==='null'){yield null;continue;}
     if(count===6&&globalThis.decoderFault==='throw')throw new Error('Injected decoder failure');
     yield canvas;
    }
   };
   const originalTrack=Input.prototype.getPrimaryVideoTrack;
   Input.prototype.getPrimaryVideoTrack=async function(){const track=await originalTrack.call(this);if(track&&['unavailable','native'].includes(globalThis.decoderFault))track.canDecode=async()=>false;return track;};
   const playbackFrame=PlaybackFrameReader.prototype.frame;
   PlaybackFrameReader.prototype.frame=async function(seconds){if(globalThis.decoderFault==='native')throw new Error('Playback decoder timed out while loading a frame.');return playbackFrame.call(this,seconds);};
   NativeFrameReader.prototype.frame=async function(seconds){
    if(!this.testPlayback){this.testUrl=URL.createObjectURL(this.file);this.testPlayback=new PlaybackFrameReader(this.testUrl,this.signal);}
    return playbackFrame.call(this.testPlayback,seconds);
   };
   const closeNative=NativeFrameReader.prototype.dispose;
   NativeFrameReader.prototype.dispose=function(){this.testPlayback?.dispose();if(this.testUrl)URL.revokeObjectURL(this.testUrl);closeNative.call(this);};
  `});
 });
 await page.goto(url);
 const bytes=Array.from(await readFile(fixture));
 for(const mode of ['normal','null','throw','unavailable','native']){
  const result=await page.evaluate(async({bytes,mode})=>{
   globalThis.decoderFault=mode;
   const {exportSequence}=await import('/src/export.ts');
   const {fresh}=await import('/src/model.ts');
   const file=new File([new Uint8Array(bytes)],'changing.webm',{type:'video/webm'}),url=URL.createObjectURL(file);
   const project=fresh();project.width=320;project.height=180;
   project.assets=[{id:'a',name:file.name,size:file.size,modified:0,duration:1,kind:'video',width:160,height:90}];
   // Repeated source, a dissolve, a trim and simultaneous overlay decoder.
   project.clips=[{id:'one',assetId:'a',inFrame:0,frames:30,volume:1,transitionFrames:6,transition:'dissolve'},
    {id:'two',assetId:'a',inFrame:15,frames:15,volume:1},
    {id:'overlay',assetId:'a',inFrame:0,frames:20,volume:0,track:'v2',startFrame:5,scale:.3,x:.8,y:.8}];
   const phases=[];
   try{const blob=await exportSequence(project,new Map([['a',{file,url}]]),'webm',new AbortController().signal,(_,phase)=>phases.push(phase),{resolution:480,fps:30,quality:'compact'});return {bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),fallback:phases.some(phase=>phase==='Rendering with preview decoder'||phase==='Rendering with native frame recovery')};}
   finally{URL.revokeObjectURL(url);}
  },{bytes,mode});
  assert.equal(result.fallback,mode!=='normal');
  const out=join(folder,mode+'.webm');await writeFile(out,new Uint8Array(result.bytes));
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames','-of','json',out],{encoding:'utf8'}));
  assert.equal(Number(info.streams.find(s=>s.codec_type==='video').nb_read_frames),39);
  for(const [time,channel] of [['0.1',0],['0.8',2],['1.2',2]]){
   const pixels=execFileSync('ffmpeg',['-v','error','-ss',time,'-i',out,'-frames:v','1','-vf','crop=2:2:iw/2:ih/2,format=rgb24','-f','rawvideo','pipe:1']);
   assert.ok(pixels[channel]>190,`${mode} correct moving source at ${time}s: ${pixels}`);
  }
  const audio=execFileSync('ffmpeg',['-v','error','-i',out,'-vn','-ac','1','-f','f32le','pipe:1']);let energy=0;
  for(let i=0;i<audio.length;i+=4)energy+=audio.readFloatLE(i)**2;
  assert.ok(Math.sqrt(energy/(audio.length/4))>.02,mode+' retains audio');
  console.log(mode+': 39 frames, changing picture, repeated/overlapping clips and audible mix verified.');
 }
 const message=await page.evaluate(async bytes=>{
  globalThis.decoderFault='unavailable';
  const {exportSequence}=await import('/src/export.ts');const {fresh}=await import('/src/model.ts');
  const file=new File([new Uint8Array(bytes)],'failed-source.webm',{type:'video/webm'}),project=fresh();project.width=320;project.height=180;
  project.assets=[{id:'a',name:file.name,size:file.size,modified:0,duration:1,kind:'video',width:160,height:90}];project.clips=[{id:'clip',assetId:'a',inFrame:0,frames:30,volume:0}];
  try{await exportSequence(project,new Map([['a',{file,url:'data:video/webm;base64,'}]]),'webm',new AbortController().signal,()=>{},{resolution:480,fps:30,quality:'compact'});return '';}
  catch(error){return error.message;}
 },bytes);
 assert.match(message,/failed-source.webm.*timeline 0.000s.*source 0.000s.*Preview decoder/);
 const cancelled=await page.evaluate(async()=>{
  const {PlaybackFrameReader}=await import('/src/playback-frame.ts');const controller=new AbortController();
  const reader=new PlaybackFrameReader('data:video/webm;base64,',controller.signal);
  const pending=reader.frame(0);controller.abort();try{await pending;return false;}catch(error){return error.name==='AbortError';}finally{reader.dispose();}
 });assert.ok(cancelled,'Cancellation interrupts a pending playback decode');
}finally{await browser?.close();await server?.close();await rm(folder,{recursive:true,force:true});}
