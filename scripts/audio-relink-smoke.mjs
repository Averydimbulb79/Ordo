// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import ts from 'typescript';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'first.mp3'),blue=join(folder,'second.mp3'),impostor=join(folder,'impostor.mp3'),renamed=join(folder,'renamed.mp3');
for(const [path,hz] of [[fixture,440],[blue,880]])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`sine=frequency=${hz}:sample_rate=48000`,'-t','3','-c:a','libmp3lame','-b:a','128k','-metadata','comment=alpha',path]);
const changed=Buffer.from(await readFile(fixture)),tag=changed.indexOf(Buffer.from('alpha'));assert.ok(tag>=0);changed.write('bravo',tag);await writeFile(impostor,changed);await writeFile(renamed,await readFile(fixture));
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  const target=path===root?join(root,'index.html'):path;
  res.setHeader('Content-Type',({'html':'text/html','js':'application/javascript','css':'text/css','map':'application/json'})[extname(target).slice(1)]||'application/octet-stream');res.end(await readFile(target));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();const url=`http://127.0.0.1:${address.port}/`;
const enginePath=join(root,'__audio-engine-test.js');await writeFile(enginePath,ts.transpileModule(await readFile('src/audio-engine.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 // Tap the real preview output without altering its audible routing.
 await page.addInitScript(()=>{
  const connect=AudioNode.prototype.connect;window.previewLevels=[];
  AudioNode.prototype.connect=function(destination,...args){
   if(destination===this.context.destination&&this.context instanceof AudioContext){
    const split=this.context.createChannelSplitter(2),left=this.context.createAnalyser(),right=this.context.createAnalyser();left.fftSize=right.fftSize=2048;
    connect.call(this,split);split.connect(left,0);split.connect(right,1);window.previewLevels.push([left,right]);
   }
   return connect.call(this,destination,...args);
  };
 });
 await page.goto(url);
 const dsp=await page.evaluate(async()=>{
  const {createAudioChain}=await import('/__audio-engine-test.js');
  const render=async(settings={},bypass=false,hz=100,amplitude=.1)=>{const c=new OfflineAudioContext(2,24000,48000),source=c.createBufferSource(),buffer=c.createBuffer(1,24000,48000),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=amplitude*Math.sin(2*Math.PI*hz*i/48000);source.buffer=buffer;const chain=createAudioChain(c,source,c.destination);chain.update(settings,bypass);chain.setLevel(1);source.start();const result=await c.startRendering();return [0,1].map(ch=>{const x=result.getChannelData(ch).slice(12000);return Math.sqrt(x.reduce((n,v)=>n+v*v,0)/x.length);});};
  return {neutral:await render(),gain:await render({gainDb:6}),bass:await render({bass:12}),pan:await render({pan:-1}),boosted:await render({gainDb:12}),compressedQuiet:await render({compressor:true,threshold:-30,ratio:10}),compressed:await render({gainDb:12,compressor:true,threshold:-30,ratio:10}),loud:await render({gainDb:24},false,100,.5),limited:await render({gainDb:24,limiter:true},false,100,.5),bypass:await render({gainDb:12,pan:1,bass:18,compressor:true,limiter:true},true)};
 });
 assert.ok(dsp.gain[0]>dsp.neutral[0]*1.9&&dsp.gain[0]<dsp.neutral[0]*2.1);assert.ok(dsp.bass[0]>dsp.neutral[0]*3);assert.ok(dsp.pan[1]<.0001&&dsp.pan[0]>.05);assert.ok(dsp.compressed[0]/dsp.compressedQuiet[0]<2);assert.ok(dsp.limited[0]<dsp.loud[0]*.8);assert.ok(Math.abs(dsp.bypass[0]-dsp.neutral[0])<.0001&&Math.abs(dsp.bypass[1]-dsp.neutral[1])<.0001);
 await page.locator('#media-file').setInputFiles([fixture,blue]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);
 await page.locator('#add-all-media').click();assert.equal(await page.locator('.clip[data-track="a1"]').count(),2);
 await page.locator('.clip').first().click();await page.locator('#tool-adjust').click();await page.getByRole('dialog',{name:'Adjust audio',exact:true}).waitFor();
 for(const key of ['gainDb','pan','bass','mid','treble','threshold','ratio','attack','release','fadeIn','fadeOut'])assert.equal(await page.locator('#audio-'+key).count(),1);
 const set=async(key,value)=>page.locator('#audio-'+key).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input'));},value);
 await set('gainDb',6);await set('pan',-1);await set('bass',3);await page.locator('.creative-apply').click();
 await page.locator('.clip').nth(1).click();await page.locator('#tool-adjust').click();await set('pan',1);await page.locator('.creative-apply').click();
 await page.locator('.clip').first().click();await page.locator('#tool-transitions').click();await page.getByRole('dialog',{name:'Audio transitions',exact:true}).waitFor();
 await page.locator('#audio-crossfade-enabled').check();await page.locator('#audio-crossfade-duration').fill('1');await page.locator('#audio-first-fade').fill('1');await page.locator('#audio-last-fade').fill('1');await page.locator('.creative-apply').click();
 assert.equal(await page.locator('#total-time').innerText(),'00:00:05:00');assert.equal(await page.locator('.audio-transition-marker').count(),1);
 await page.locator('#undo').click();assert.equal(await page.locator('#total-time').innerText(),'00:00:06:00');await page.locator('#redo').click();
 const levels=()=>page.evaluate(()=>{
  const rms=a=>{const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((n,v)=>n+v*v,0)/x.length);};return window.previewLevels.map(([l,r])=>[rms(l),rms(r)]).reduce((a,b)=>[a[0]+b[0],a[1]+b[1]],[0,0]);
 });
 await page.locator('.clip').first().click();await page.locator('#play').click();await page.waitForTimeout(500);let sound=await levels();assert.ok(sound[0]>.01&&sound[1]<.002,`Live preview pans left: ${sound}`);
 await page.locator('#compare-adjustments').uncheck();await page.waitForTimeout(200);sound=await levels();assert.ok(sound[0]>.01&&sound[1]>.01,`Audio bypass restores centred sound: ${sound}`);await page.locator('#compare-adjustments').check();await page.locator('#play').click();
 const saveProject=async()=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(folder,'audio.ordo');await(await pending).saveAs(path);return{path,p:JSON.parse(await readFile(path,'utf8'))};};
 const saved=await saveProject();assert.equal(saved.p.version,4);assert.ok(saved.p.assets.every(a=>/^[a-f0-9]{64}$/.test(a.sha256)));assert.equal(saved.p.clips[0].audioCrossfadeFrames,30);assert.equal(saved.p.clips[0].audio.fadeIn,1);assert.equal(saved.p.clips[1].audio.fadeOut,1);
 await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.locator('#export-resolution').selectOption('480');await page.locator('#export-fps').selectOption('24');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
 const download=page.waitForEvent('download',{timeout:180000});await page.locator('#start-export').click();const output=join(folder,'audio.webm');await(await download).saveAs(output);await page.locator('#close-export').click();
 const raw=execFileSync('ffmpeg',['-v','error','-i',output,'-vn','-ac','2','-ar','48000','-f','f32le','pipe:1'],{maxBuffer:3000000});
 const samples=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
 const rms=(from,to,ch)=>{let sum=0,count=0;for(let i=Math.floor(from*48000);i<Math.floor(to*48000);i++){sum+=samples[i*2+ch]**2;count++;}return Math.sqrt(sum/count);};
 assert.ok(rms(.8,.95,0)>rms(.02,.1,0)*4,'First clip fades in');assert.ok(rms(.8,.95,0)>.08&&rms(.8,.95,1)<.003,'Export retains gain and left pan');
 assert.ok(rms(2.35,2.65,0)>.04&&rms(2.35,2.65,1)>.025,'Both clips survive the crossfade');assert.ok(rms(4,4.2,1)>rms(4.85,4.95,1)*4,'Last clip fades out');assert.ok(rms(3.5,3.8,0)<.003,'Second clip pans right');
 // Keep signal-processing state across source windows, including compressor release.
 for(const t of [1,2,3,4])assert.ok(rms(t-.025,t+.025,t<3?0:1)>.002,`No silent block seam at ${t}s`);
 await page.reload();await page.locator('#project-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.querySelectorAll('.clip').length===2&&!document.querySelector('.clip.missing'));
 assert.match(await page.locator('#import-feedback').innerText(),/2 media assets automatically reconnected/);
 await page.locator('.media-storage summary').click();await page.locator('#forget-media').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Remembered media forgotten'));await page.reload();await page.locator('#project-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.querySelectorAll('.clip.missing').length===2);
 await page.locator('#locate-files').setInputFiles(impostor);await page.waitForFunction(()=>document.querySelector('#import-feedback').classList.contains('is-error'));assert.equal(await page.locator('.clip.missing').count(),2,'Wrong bytes with the same source name/size must not relink');
 await page.locator('#locate-files').setInputFiles([renamed,blue]);await page.waitForFunction(()=>!document.querySelector('.clip.missing'));assert.match(await page.locator('#import-feedback').innerText(),/2 media assets relinked/);
 const relinked=await saveProject();assert.deepEqual(relinked.p.clips,saved.p.clips,'Relinking preserves all edits');assert.deepEqual(relinked.p.assets,saved.p.assets,'Renamed source matches by content without changing asset identities');
 // Edge fades must remain usable when clips have an intentional gap and no crossfade.
 await page.locator('.clip').first().click();await page.locator('#tool-transitions').click();await page.locator('#audio-crossfade-enabled').uncheck();await page.locator('.creative-apply').click();
 await page.locator('.clip').nth(1).click();await page.locator('#clip-start').fill('4');await page.locator('#apply-placement').click();await page.locator('.clip').first().click();await page.locator('#tool-transitions').click();await page.locator('#audio-first-fade').fill('.5');await page.locator('#audio-last-fade').fill('.5');await page.locator('.creative-apply').click();await page.locator('.creative-dialog').waitFor({state:'detached'});
 const gap=await saveProject();assert.equal(gap.p.clips[1].startFrame,120);assert.equal(gap.p.clips[0].audio.fadeIn,.5);assert.equal(gap.p.clips[1].audio.fadeOut,.5);assert.equal(gap.p.clips[0].audioCrossfadeFrames,undefined);
 // Check the mobile audio panel and its accessible checkbox controls.
 await page.setViewportSize({width:390,height:844});await page.locator('.clip').first().click();await page.locator('#dock-adjust').click();await page.getByRole('dialog',{name:'Adjust audio'}).waitFor();await page.screenshot({path:resolve('../ordo-audio-panel.png')});await page.locator('.creative-cancel').click();

 // Exercise the actual Capacitor JS bridge path using a provider fixture. Android
 // OS grants themselves remain a real-device validation task.
 const nativeContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const native=await nativeContext.newPage();native.on('pageerror',e=>errors.push(e.message));native.on('dialog',d=>d.accept());
 await native.route('**/native-audio',route=>route.fulfill({path:fixture,contentType:'audio/mpeg'}));
 await native.addInitScript(()=>{
  window.androidBridge={};window.nativeCalls=[];window.nativeChunks=[];
  window.Capacitor={
   PluginHeaders:[{name:'OrdoFiles',methods:['pickMedia','forgetMedia','beginSave','append','finish','abort','keepAwake','previewMode','exit'].map(name=>({name,rtype:'promise'}))}],
   convertFileSrc:()=>location.origin+'/native-audio',
   nativePromise:async(plugin,method,options)=>{
    window.nativeCalls.push({method,options});
    if(method==='pickMedia')return {files:[{uri:'content://test-provider/audio',name:'remembered.mp3',mime:'audio/mpeg',persisted:options.remember}]};
    if(method==='beginSave'){window.nativeChunks=[];return{cancelled:false,token:'test'};}
    if(method==='append'){window.nativeChunks.push(atob(options.data));return;}
    if(method==='finish'){window.nativeSavedJSON=window.nativeChunks.join('');return;}
    return {};
   }
  };
 });
 await native.goto(url);await native.locator('#import-empty').tap();await native.waitForFunction(()=>document.querySelectorAll('.media-card').length===1);
 await native.locator('#add-all-media').tap();await native.getByRole('button',{name:'Close media panel'}).tap();
 await native.locator('#dock-project').tap();await native.getByRole('dialog',{name:'Project menu',exact:true}).waitFor();assert.equal(await native.evaluate(()=>window.nativeCalls.filter(c=>c.method==='pickMedia').length),1,'Opening Project must not click through into another native import');await native.locator('#save').tap();await native.waitForFunction(()=>!!window.nativeSavedJSON);const nativeJSON=await native.evaluate(()=>window.nativeSavedJSON);
 const nativeProject=JSON.parse(nativeJSON),digest=nativeProject.assets[0].sha256;
 const record=await native.evaluate(hash=>new Promise((resolve,reject)=>{const req=indexedDB.open('ordo-media');req.onsuccess=()=>{const db=req.result,r=db.transaction('media').objectStore('media').get(hash);r.onsuccess=()=>{resolve({uri:r.result.native?.uri,copied:!!r.result.file});db.close();};r.onerror=reject;};req.onerror=reject;}),digest);
 assert.deepEqual(record,{uri:'content://test-provider/audio',copied:false},'Persisted Android picks remember the URI rather than copying the entire file');
 assert.equal(await native.evaluate(()=>window.nativeCalls.find(c=>c.method==='pickMedia').options.remember),true);
 await native.reload();await native.locator('#project-file').setInputFiles({name:'native.ordo',mimeType:'application/json',buffer:Buffer.from(nativeJSON)});await native.waitForFunction(()=>document.querySelectorAll('.clip').length===1&&!document.querySelector('.clip.missing'));
 assert.match(await native.locator('#import-feedback').innerText(),/1 media asset automatically reconnected/);
 await native.locator('#dock-media').tap();await native.locator('.media-storage summary').tap();await native.locator('#forget-media').tap();await native.waitForFunction(()=>window.nativeCalls.some(c=>c.method==='forgetMedia'));assert.equal(await native.evaluate(()=>window.nativeCalls.some(c=>c.method==='forgetMedia')),true);
 await nativeContext.close();
 assert.deepEqual(errors,[]);console.log('Audio and relink checks passed: MP3 import, live pan and bypass, gain/EQ, crossfade and edge fades, audible export with continuous processing, undo, v4 persistence, full-reload auto relink, wrong-file rejection, renamed batch relink, mobile panel and Capacitor URI-reference restore.');
}finally{await rm(enginePath,{force:true});await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
