// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'red.webm'),blue=join(folder,'blue.webm');
for(const [path,colour,hz] of [[fixture,'red',440],[blue,'blue',880]])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${colour}:s=320x180:r=30`,'-f','lavfi','-i',`sine=frequency=${hz}:sample_rate=48000`,'-t','3','-c:v','libvpx','-b:v','300k','-c:a','libopus',path]);
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
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#media-file').setInputFiles([fixture,blue]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);
 await page.locator('.media-card img').first().waitFor();assert.equal(await page.locator('.media-duration').first().innerText(),'0:03');
 const add=async(card,track)=>{await page.locator('.media-card').nth(card).locator('select').selectOption(track);await page.locator('.media-card').nth(card).getByRole('button',{name:'Add to sequence'}).click();};
 await add(0,'v1');await add(1,'v1');
 await page.locator('.clip').first().click();await page.locator('#tool-transitions').click();await page.locator('[data-transition="dissolve"]').click();await page.locator('#transition-duration').fill('1');await page.locator('.creative-apply').click();
 assert.equal(await page.locator('#total-time').innerText(),'00:00:05:00');assert.equal(await page.locator('.transition-marker').count(),1);
 // Keep the main track silent so the exported soundtrack must come from A1 and A2.
 for(const index of [0,1]){await page.locator('.clip').nth(index).click();await page.locator('#volume').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('change'));});}
 await page.locator('#scrub').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input'));});
 await add(1,'v2');await add(0,'a1');await add(1,'a2');
 for(const track of ['a1','a2']){await page.locator(`.clip[data-track="${track}"]`).click();await page.locator('#volume').evaluate(el=>{el.value='50';el.dispatchEvent(new Event('change'));});}
 // All four tracks now have real placements. V2 defaults to picture-in-picture.
 assert.equal(await page.locator('.clip').count(),5);
 const seek=async frame=>{await page.locator('#scrub').evaluate((el,f)=>{el.value=String(f);el.dispatchEvent(new Event('input'));},frame);await page.waitForTimeout(700);};
 const pixels=()=>page.locator('#preview').evaluate(canvas=>{const c=canvas.getContext('2d');return {centre:Array.from(c.getImageData(640,360,1,1).data),corner:Array.from(c.getImageData(960,540,1,1).data)};});
 await seek(0);let values=await pixels();assert.ok(values.centre[0]>200&&values.centre[2]<40,JSON.stringify(values));assert.ok(values.corner[2]>200,'Overlay is visible in its own position');
 await seek(55);await page.locator('#play').click();await page.waitForTimeout(1100);await page.locator('#play').click();assert.notEqual(await page.locator('#current-time').innerText(),'00:00:01:25','Playback advances across the dissolve');
 await seek(75);values=await pixels();assert.ok(values.centre[0]>80&&values.centre[2]>80,`Preview dissolve is purple: ${JSON.stringify(values)}`);
 if(process.env.ORDO_COMPOSITION_SCREENSHOT)await page.screenshot({path:process.env.ORDO_COMPOSITION_SCREENSHOT});
 const saved=page.waitForEvent('download');await page.locator('#save').click();const projectFile=join(folder,'layers.ordo');await(await saved).saveAs(projectFile);
 const json=JSON.parse(await readFile(projectFile,'utf8'));assert.equal(json.version,4);assert.equal(json.clips.filter(c=>c.track==='a1'||c.track==='a2').length,2);
 await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
 const exported=page.waitForEvent('download',{timeout:120000});await page.locator('#start-export').click();const output=join(folder,'layers.webm');await(await exported).saveAs(output);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames','-of','json',output],{encoding:'utf8'}));assert.equal(info.streams.find(s=>s.codec_type==='video').nb_read_frames,'150');
 const raw=execFileSync('ffmpeg',['-v','error','-i',output,'-vf','select=eq(n\\,75)','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:4000000});
 const centre=Array.from(raw.subarray((360*1280+640)*3,(360*1280+640)*3+3));assert.ok(centre[0]>80&&centre[2]>80,`Export matches purple dissolve: ${centre}`);
 const audio=execFileSync('ffmpeg',['-v','error','-i',output,'-vn','-t','1','-ac','1','-ar','48000','-f','f32le','pipe:1'],{maxBuffer:1000000});
 const samples=new Float32Array(audio.buffer,audio.byteOffset,audio.length/4);
 for(const hz of [440,880]){let re=0,im=0;for(let i=0;i<samples.length;i++){re+=samples[i]*Math.cos(2*Math.PI*hz*i/48000);im+=samples[i]*Math.sin(2*Math.PI*hz*i/48000);}assert.ok(2*Math.hypot(re,im)/samples.length>.02,`Independent ${hz} Hz soundtrack survived export`);}
 execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);assert.deepEqual(errors,[]);
 console.log('Composition checks passed: thumbnails/duration, four tracks, picture-in-picture preview, cross-dissolve pixels in preview/export, both independent soundtracks, project persistence and 150 decoded output frames.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
