// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'source.webm');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','3','-c:v','libvpx','-b:v','300k','-c:a','libopus',fixture]);
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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#media-file').setInputFiles(fixture);await page.getByRole('button',{name:'Add to sequence'}).click();
 await page.locator('.clip').click();await page.locator('#scrub').evaluate(el=>{el.value='30';el.dispatchEvent(new Event('input'));});await page.locator('#split').click();
 assert.equal(await page.locator('.clip').count(),2);await page.locator('#undo').click();assert.equal(await page.locator('.clip').count(),1);await page.locator('#redo').click();
 await page.locator('.clip').last().click();await page.locator('#trim-in').fill('35');await page.locator('#trim-out').fill('70');await page.locator('#apply-trim').click();assert.equal(await page.locator('#total-time').textContent(),'00:00:02:05');
 const saved=page.waitForEvent('download');await page.locator('#save').click();const project=await saved;const projectFile=join(folder,'test.ordo');await project.saveAs(projectFile);
 await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
 const exported=page.waitForEvent('download',{timeout:120000});await page.locator('#start-export').click();const video=await exported;const output=join(folder,'output.webm');await video.saveAs(output);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames,width,height','-of','json',output],{encoding:'utf8'}));
 assert.equal(metadata.streams.find(s=>s.codec_type==='video').nb_read_frames,'65');assert.ok(metadata.streams.some(s=>s.codec_type==='audio'));execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);
 await page.locator('#close-export').click();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Reopen in a clean context so source files genuinely need relinking.
 const second=await browser.newPage({viewport:{width:1440,height:960}});second.on('pageerror',e=>errors.push(e.message));second.setDefaultTimeout(15000);
 await second.goto(url);await second.locator('#project-file').setInputFiles(projectFile);await second.waitForFunction(()=>document.querySelectorAll('.clip').length===2);
 assert.equal(await second.locator('#total-time').textContent(),'00:00:02:05');await second.getByRole('button',{name:'Relink',exact:true}).click();await second.locator('#relink-file').setInputFiles(fixture);await second.waitForFunction(()=>!document.querySelector('.clip.missing'));
 await second.locator('.clip').first().click();await second.locator('#play').click();await second.waitForTimeout(1400);await second.locator('#play').click();assert.notEqual(await second.locator('#current-time').textContent(),'00:00:00:00');
 await second.locator('.clip').last().click();await second.locator('#delete').click();assert.equal(await second.locator('.clip').count(),1);await second.locator('#undo').click();assert.equal(await second.locator('.clip').count(),2);
 await second.locator('.clip').last().click();await second.locator('#export').click();await second.locator('#format').selectOption('webm');await second.waitForFunction(()=>!document.querySelector('#start-export').disabled);await second.locator('#start-export').click();await second.locator('#cancel-export').click();await second.waitForFunction(()=>!document.querySelector('#close-export').disabled);assert.match(await second.locator('#format-status').textContent(),/cancel/i);
 assert.deepEqual(errors,[]);console.log('Browser smoke passed: boot, import, split, trim, undo/redo, save, reopen, relink, playback, WebM audio/video export, cancellation and mobile layout.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
