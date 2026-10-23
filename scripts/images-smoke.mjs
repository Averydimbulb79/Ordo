// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'red.png'),blue=join(folder,'blue.png');
for(const [path,colour] of [[fixture,'red'],[blue,'blue']])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${colour}:s=640x360`,'-frames:v','1','-threads','1',path]);
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
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});page.setDefaultTimeout(20000);
 const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))remote.push(r.url());});await page.goto(url);
 const seek=async frame=>{await page.locator('#scrub').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input'));},frame);await page.waitForTimeout(250);};
 const pixel=()=>page.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(c.width/2,c.height/4,1,1).data).slice(0,3));
 const save=async()=>{const ready=page.waitForEvent('download');await page.locator('#save').click();const d=await ready,path=join(folder,'project.ordo');await d.saveAs(path);return{path,p:JSON.parse(await readFile(path,'utf8'))};};
 await page.locator('#media-file').setInputFiles([fixture,blue]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);await page.waitForFunction(()=>document.querySelectorAll('.media-badge img').length===2);
 assert.deepEqual(await page.locator('.media-duration').allTextContents(),['0:06','0:06']);await page.locator('#add-all-media').click();assert.equal(await page.locator('.clip').count(),2);
 let saved=await save();assert.ok(saved.p.assets.every(a=>a.kind==='image'&&a.duration===6));assert.ok(saved.p.clips.every(c=>c.frames===180));
 await page.locator('.clip').first().click();await page.locator('#trim-out').fill('210');await page.locator('#apply-trim').click();await seek(195);assert.ok((await pixel())[0]>200,'Image remains visible past its six second default');
 await page.locator('#play').click();await page.waitForTimeout(200);assert.ok(Number(await page.locator('#scrub').inputValue())>195,'Image-only playback advances');await page.locator('#play').click();
 await page.locator('#trim-out').fill('60');await page.locator('#apply-trim').click();await page.locator('.clip').nth(1).click();await page.locator('#trim-out').fill('60');await page.locator('#apply-trim').click();await page.locator('.clip').first().click();await seek(15);
 await page.locator('#tool-adjust').click();await page.locator('#adjust-saturation').evaluate(el=>{el.value='-100';el.dispatchEvent(new Event('input'));});await page.locator('.creative-apply').click();
 let colour=await pixel();assert.ok(Math.abs(colour[0]-colour[1])<4&&Math.abs(colour[1]-colour[2])<4,'Image adjustment renders');
 await page.locator('#tool-crop').click();await page.locator('#crop-canvas[data-ready="true"]').waitFor();await page.locator('#crop-ratio').selectOption('1:1');await page.locator('.creative-apply').click();
 await page.locator('#tool-transitions').click();assert.deepEqual(await page.locator('#transition-category option').allTextContents(),['Start','End','Between']);
 await page.locator('#transition-category').selectOption('start');await page.locator('[data-transition="dissolve"]').click();await page.locator('#transition-duration').fill('0.5');await page.locator('.creative-apply').click();
 await seek(0);assert.ok((await pixel()).every(n=>n<3),'Start dissolve begins at black');await seek(15);assert.ok((await pixel())[0]>40,'Start animation reveals image');
 // Every edge effect renders on a still; direction is consistent at both ends.
 const effects=['dissolve','fade-black','fade-white','wipe-left','wipe-right','wipe-up','wipe-down','slide-left','slide-right','push-left','push-right','zoom-in','zoom-out'];
 const sides=()=>page.locator('#preview').evaluate(c=>[.35,.65].map(x=>Array.from(c.getContext('2d').getImageData(c.width*x,c.height/4,1,1).data).slice(0,3)));
 await seek(7);await page.locator('#tool-transitions').click();await page.locator('#transition-category').selectOption('start');
 for(const effect of effects){await page.locator(`[data-transition="${effect}"]`).click();await page.waitForTimeout(90);if(effect==='wipe-left'){const p=await sides();assert.ok(p[0][0]<5&&p[1][0]>35,'Start wipe moves left to reveal image');}}
 await page.locator('[data-transition="dissolve"]').click();await page.locator('.creative-apply').click();
 await page.locator('.clip').nth(1).click();await page.locator('#tool-transitions').click();await page.locator('#transition-category').selectOption('end');await page.locator('[data-transition="dissolve"]').click();await page.locator('.creative-apply').click();
 await seek(113);await page.locator('#tool-transitions').click();await page.locator('#transition-category').selectOption('end');
 for(const effect of effects){await page.locator(`[data-transition="${effect}"]`).click();await page.waitForTimeout(90);if(effect==='wipe-left'){const p=await sides();assert.ok(p[0][2]>180&&p[1][2]<5,'End wipe moves left to remove image');}}
 await page.locator('[data-transition="dissolve"]').click();await page.locator('.creative-apply').click();
 await page.locator('.clip').first().click();await page.locator('#tool-transitions').click();await page.locator('#transition-category').selectOption('between');await page.locator('[data-transition="wipe-left"]').click();await page.locator('.creative-apply').click();
 await seek(104);assert.ok((await pixel())[2]<30,'End transition fades out the last image');
 await page.locator('#tool-title').click();const fonts=await page.locator('#text-font option').evaluateAll(options=>options.map(o=>o.value));assert.equal(fonts.length,66);assert.equal(new Set(fonts).size,66);
 const faceCounts=await page.evaluate(async families=>{const result=[];for(const family of families){const variants=[];for(const style of ['normal 400','italic 400','normal 700','italic 700'])variants.push((await document.fonts.load(`${style} 48px "${family}"`,'Ordo')).length);result.push([family,variants]);}return result;},fonts);assert.ok(faceCounts.every(([,counts])=>counts.every(n=>n>0)),JSON.stringify(faceCounts.filter(([,counts])=>counts.some(n=>!n))));
 await page.locator('#text-content').fill('Image story');await page.locator('#text-font').selectOption('Inter');await page.locator('#text-start').fill('0.5');await page.locator('#text-duration').fill('1');await page.locator('[data-style="italic"]').click();await page.locator('.creative-apply').click();
 await page.locator('#tool-captions').click();assert.equal(await page.locator('#text-font option').count(),66);await page.locator('.creative-cancel').click();
 saved=await save();assert.equal(saved.p.version,5);assert.equal(saved.p.clips[0].startTransition.type,'dissolve');assert.equal(saved.p.clips[1].endTransition.type,'dissolve');assert.equal(saved.p.clips[0].transition,'wipe-left');assert.ok(saved.p.clips[0].crop.width<1);assert.equal(saved.p.texts[0].fontFamily,'Inter');
 // A graded transparent PNG on V2 must retain its alpha channel.
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#ffff00';x.fillRect(0,0,320,360);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#media-file').setInputFiles({name:'overlay.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===3);await seek(20);
 await page.locator('.media-card').nth(2).locator('select').selectOption('v2');await page.locator('.media-card').nth(2).getByRole('button',{name:'Add to sequence'}).click();await page.locator('#trim-out').fill('60');await page.locator('#apply-trim').click();await seek(70);
 await page.locator('#tool-adjust').click();await page.locator('#adjust-saturation').evaluate(el=>{el.value='-100';el.dispatchEvent(new Event('input'));});await page.locator('.creative-apply').click();
 await page.locator('#tool-transitions').click();await page.locator('#transition-category').selectOption('start');await page.locator('[data-transition="fade-black"]').click();await page.locator('#transition-duration').fill('10');await page.locator('.creative-apply').click();
 const alpha=await page.locator('#preview').evaluate(c=>[.65,.85].map(x=>Array.from(c.getContext('2d').getImageData(c.width*x,c.height*.75,1,1).data).slice(0,3)));assert.ok(alpha[0][0]>150&&Math.abs(alpha[0][0]-alpha[0][2])<5,'Opaque part is graded');assert.ok(alpha[1][2]>200&&alpha[1][0]<15,'Grading keeps transparent part clear');saved=await save();
 await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.locator('#export-resolution').selectOption('480');await page.locator('#export-fps').selectOption('24');await page.locator('#export-quality').selectOption('compact');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
 const render=page.waitForEvent('download',{timeout:120000});await page.locator('#start-export').click();const out=join(folder,'images.webm');await(await render).saveAs(out);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames,r_frame_rate','-of','json',out],{encoding:'utf8'}));assert.equal(info.streams.length,1);assert.equal(Number(info.streams[0].nb_read_frames),84);assert.equal(info.streams[0].r_frame_rate,'24/1');
 const decodedPixel=time=>{const bytes=execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',out,'-frames:v','1','-vf','crop=1:1:iw/2:ih/4,format=rgb24','-f','rawvideo','pipe:1']);return Array.from(bytes.slice(0,3));};assert.ok(decodedPixel(0).every(n=>n<8),'Start baked into export');const gray=decodedPixel(.6);assert.ok(Math.abs(gray[0]-gray[1])<10&&Math.abs(gray[1]-gray[2])<10&&gray[0]>35,'Grading baked into image export');assert.ok(decodedPixel(3.45)[2]<45,'End baked into export');const transparent=execFileSync('ffmpeg',['-v','error','-ss','2.3','-i',out,'-frames:v','1','-vf','crop=1:1:iw*0.85:ih*0.75,format=rgb24','-f','rawvideo','pipe:1']);assert.ok(transparent[2]>180&&transparent[0]<25,'PNG transparency is baked into graded overlay export');await page.locator('#close-export').click();
 // Reopen automatically restores remembered stills by their content hash.
 await page.reload();await page.locator('#project-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.querySelectorAll('.clip').length===3);await seek(20);assert.ok((await pixel())[0]>35);assert.equal(await page.getByRole('button',{name:'Relink',exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});await page.locator('.clip').first().click();await page.locator('#dock-transitions').click();await page.locator('#transition-category').selectOption('start');assert.equal(await page.locator('#transition-all').isVisible(),true);if(process.env.ORDO_IMAGES_SCREENSHOT)await page.screenshot({path:process.env.ORDO_IMAGES_SCREENSHOT});await page.locator('.creative-cancel').click();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('Image checks passed: 6s import/thumbnails, bulk add, extend/shorten, playback, crop/grade, Start/End/Between, 66 offline fonts in four styles, titles/captions, v5 auto relink and decoded 480p/24fps image export, mobile categories.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
