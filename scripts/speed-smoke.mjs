import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright';import {createServer} from 'vite';
const folder=await mkdtemp(join(tmpdir(),'ordo-speed-'));let server,browser;
try{
 const video=join(folder,'speed.webm');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=320x180:r=30:d=3','-f','lavfi','-i','color=blue:s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a','-c:v','libvpx','-c:a','libopus',video]);
 server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true,hasTouch:width===390});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{globalThis.testPlayers=[];const create=document.createElement.bind(document);document.createElement=(...args)=>{const element=create(...args);if(args[0]==='video')globalThis.testPlayers.push(element);return element;};});await page.goto(server.resolvedUrls.local[0]);await page.locator('#media-file').setInputFiles(video);await page.locator('.media-card').waitFor();await page.locator('#add-all-media').click();if(width===390)await page.locator('.sheet-close').filter({visible:true}).first().click();await page.locator('.clip').first().click();if(width===390)await page.locator('#dock-edit').click();
  await page.locator('#speed-preset').selectOption('2');await page.locator('#apply-speed').click();assert.equal(await page.locator('#total-time').innerText(),'00:00:03:00');assert.equal(await page.locator('#clip-speed').inputValue(),'2');
  if(width===390)await page.locator('.sheet-close').filter({visible:true}).first().click();
  const projectDownload=page.waitForEvent('download');if(width===390)await page.locator('#dock-project').click();await page.locator('#save').click();const saved=await projectDownload;const projectFile=join(folder,`speed-${width}.ordo`);await saved.saveAs(projectFile);const project=JSON.parse(await readFile(projectFile,'utf8'));assert.equal(project.version,6);assert.equal(project.clips[0].speed,2);assert.equal(project.clips[0].sourceFrames,180);assert.equal(project.clips[0].frames,90);
  if(width===390)await page.locator('.sheet-close').filter({visible:true}).first().click();
  // Inspect real preview media created by the editor, rather than a stand-in player.
  await page.locator('#play').click();await page.waitForFunction(()=>globalThis.testPlayers.some(v=>v.playbackRate===2&&v.preservesPitch&&!v.paused));await page.locator('#play').click();
  if(width===1440){
   const offline=await page.evaluate(async()=>{
    const code=await(await fetch('/src/export.ts')).text(),dependency=code.match(/from ["']([^"']*mediabunny[^"']*)["']/)[1];const {Input,BlobSource,ALL_FORMATS,AudioBufferSink}=await import(dependency),{fresh}=await import('/src/model.ts'),{renderAudioMix}=await import('/src/audio-export.ts');
    const imported=globalThis.testPlayers.find(v=>v.src.startsWith('blob:'));const file=await(await fetch(imported.src)).blob(),input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
    try{const sink=new AudioBufferSink(await input.getPrimaryAudioTrack()),results=[];
     for(const speed of [.5,1.5,4]){const frames=Math.ceil(180/speed),p={...fresh(),assets:[],clips:[{id:'c',assetId:'a',inFrame:0,sourceFrames:180,frames,speed,preservePitch:true,volume:1}]};const buffer=await renderAudioMix(p,new Map([['a',sink]]),frames,30,new AbortController().signal,()=>{}),samples=buffer.getChannelData(0),rate=buffer.sampleRate;
      const rms=(time,d=.03)=>{const start=Math.round(time*rate),count=Math.min(Math.round(d*rate),samples.length-start);let sum=0;for(let i=0;i<count;i++)sum+=samples[start+i]**2;return Math.sqrt(sum/count);};
      const checks=[.5,...[4,8].filter(t=>t<buffer.duration-.1)].map(t=>({time:t,rms:rms(t)}));results.push({speed,duration:buffer.duration,checks});
     }return results;
    }finally{input.dispose();}
   });for(const result of offline){assert.ok(Math.abs(result.duration-6/result.speed)<.04);for(const c of result.checks)assert.ok(c.rms>.02,`continuous stretched audio at ${c.time}s, speed ${result.speed}: ${c.rms}`);}
   console.log('Slow/custom/fast audio crossed decoding windows without silence: '+JSON.stringify(offline));
  }
  if(width===1440){for(const preservePitch of [true,false]){
   if(!preservePitch){await page.locator('.clip').first().click();await page.locator('#speed-preserve-pitch').uncheck();await page.locator('#apply-speed').click();}
   await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.locator('#export-resolution').selectOption('480');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);const download=page.waitForEvent('download',{timeout:120000});await page.locator('#start-export').click();const file=await download,output=join(folder,`speed-${preservePitch}.webm`);await file.saveAs(output);await page.locator('#close-export').click();
   const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',output]));assert.ok(Math.abs(Number(probe.format.duration)-3)<.12,'retimed export duration');
   const pcm=execFileSync('ffmpeg',['-v','error','-ss','0.8','-t','1','-i',output,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1'],{maxBuffer:3000000});const samples=new Float32Array(pcm.buffer,pcm.byteOffset,Math.floor(pcm.length/4));
   const energy=f=>{let re=0,im=0;for(let i=0;i<samples.length;i++){const phase=2*Math.PI*f*i/48000;re+=samples[i]*Math.cos(phase);im+=samples[i]*Math.sin(phase);}return re*re+im*im;};const desired=preservePitch?440:880,other=preservePitch?880:440;assert.ok(energy(desired)>energy(other)*10,`pitch ${desired}Hz retained`);
   for(const [time,color] of [[.5,'red'],[2.5,'blue']]){const pixel=execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',output,'-vf','scale=1:1','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);assert.ok(color==='red'?pixel[0]>pixel[2]*3:pixel[2]>pixel[0]*3,'source video retimed through colour boundary');}
  }}
  assert.deepEqual(errors,[]);console.log(width+'px: speed controls, saved source range, duration and '+(width===1440?'retimed video with 440Hz preserved / 880Hz shifted export audio':'mobile controls')+' passed');await page.close();
 }
}finally{await browser?.close();await server?.close();await rm(folder,{recursive:true,force:true});}
