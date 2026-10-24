// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'red.png'),audio=join(folder,'tone.wav');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=123','-c:a','pcm_s16le',audio]);
for(const [path,colour] of [[fixture,'red']])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${colour}:s=640x360`,'-frames:v','1','-threads','1',path]);
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
let browser,statusTimer;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});page.setDefaultTimeout(20000);
 const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))remote.push(r.url());});await page.goto(url);
 await page.locator('#media-file').setInputFiles([fixture,audio]);
 await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);
 await page.locator('#add-all-media').click();
 await page.locator('.clip').first().click();
 await page.locator('#trim-out').fill('3690');await page.locator('#apply-trim').click();
 await page.locator('#export').click();await page.locator('#format').selectOption('webm');
 await page.locator('#export-resolution').selectOption('480');await page.locator('#export-fps').selectOption('24');await page.locator('#export-quality').selectOption('compact');
 await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
 assert.doesNotMatch(await page.locator('#export-dialog').innerText(),/2 minutes|Shorten the sequence/);
 statusTimer=setInterval(()=>{void page.locator('#format-status').textContent().then(text=>console.log('Export status:',text)).catch(()=>{});},15000);
 const render=page.waitForEvent('download',{timeout:300000});await page.locator('#start-export').click();
 const out=join(folder,'long-export.webm');await(await render).saveAs(out);clearInterval(statusTimer);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames,r_frame_rate','-of','json',out],{encoding:'utf8'}));
 assert.equal(Number(info.streams.find(s=>s.codec_type==='video').nb_read_frames),2952);
 assert.equal(info.streams.find(s=>s.codec_type==='video').r_frame_rate,'24/1');
 assert.ok(info.streams.some(s=>s.codec_type==='audio'));
 const pixels=execFileSync('ffmpeg',['-v','error','-ss','122','-i',out,'-frames:v','1','-vf','crop=2:2:iw/2:ih/2,format=rgb24','-f','rawvideo','pipe:1']);
 assert.ok(pixels[0]>200&&pixels[1]<20&&pixels[2]<20,'Image is exported beyond two minutes');
 const samples=execFileSync('ffmpeg',['-v','error','-ss','122','-i',out,'-t','0.5','-vn','-ac','1','-f','f32le','pipe:1']);
 let energy=0;for(let i=0;i<samples.length;i+=4)energy+=samples.readFloatLE(i)**2;
 assert.ok(Math.sqrt(energy/(samples.length/4))>.02,'Audio remains audible beyond two minutes');
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('Long export passed: UI enabled, 123 seconds / 2952 video frames at 480p24, image pixels and audible audio verified after 122 seconds.');
}finally{clearInterval(statusTimer);await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
