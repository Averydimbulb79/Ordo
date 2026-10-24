import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const folder=await mkdtemp(join(tmpdir(),'ordo-title-'));let server,browser;
try{
 const video=join(folder,'video.webm'),audio=join(folder,'audio.wav'),image=join(folder,'still.png');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-c:v','libvpx','-c:a','libopus',video]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=3',audio]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:s=320x180','-frames:v','1','-threads','1',image]);
 server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true,hasTouch:width<500});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]);
  await page.locator('#media-file').setInputFiles([video,audio,image]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===3);await page.locator('#add-all-media').click();if(width<500)await page.locator('.sheet-close').filter({visible:true}).first().click();
  const openEdit=async()=>{if(width<500)await page.locator('#dock-edit').click();};
  await page.locator('.clip.video').first().click();await openEdit();
  await page.locator('#volume').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#apply-source-volume-all').click();
  if(width<500)await page.locator('.sheet-close').filter({visible:true}).first().click();
  await page.locator('.clip.audio').first().click();await openEdit();await page.locator('#volume').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#apply-source-volume-all').click();
  if(width<500)await page.locator('.sheet-close').filter({visible:true}).first().click();
  await page.locator(width<500?'#dock-title':'#tool-title').click();await page.locator('#text-content').fill('Move this title');
  const canvas=page.locator('#preview');
  const centre=await canvas.evaluate(async c=>{const {textBounds,}=await import('/src/text-renderer.ts');const {previewPoint}=await import('/src/text-transform.ts');const {newText}=await import('/src/creative-model.ts');const t={...newText('title',0),text:'Move this title'},b=textBounds(c.getContext('2d'),t),p=previewPoint(c,0,0);return{x:p.left+(t.x*c.width+b.x+b.width/2)*p.scale,y:p.top+(t.y*c.height+b.y+b.height/2)*p.scale,dx:c.width*p.scale*.1,dy:c.height*p.scale*.1};});
  await page.mouse.move(centre.x,centre.y);await page.mouse.down();await page.mouse.move(centre.x+centre.dx,centre.y+centre.dy,{steps:8});await page.mouse.up();
  assert.ok(Number(await page.locator('#text-x').inputValue())>57,'drag changes x');assert.ok(Number(await page.locator('#text-y').inputValue())>57,'drag changes y');
  const rotate=await page.locator('.text-rotate').boundingBox();await page.mouse.move(rotate.x+rotate.width/2,rotate.y+rotate.height/2);await page.mouse.down();await page.mouse.move(rotate.x+rotate.width/2+55,rotate.y+rotate.height/2+35,{steps:8});await page.mouse.up();assert.ok(Math.abs(Number(await page.locator('#text-rotation').inputValue()))>10,'rotation handle changes angle');
  await page.locator('#text-opacity').evaluate(el=>{el.value='50';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#text-start-effect').selectOption('dissolve');await page.locator('#text-end-effect').selectOption('wipe-left');await page.locator('.creative-apply').click();
  await page.locator('.text-selection').waitFor({state:'detached'});assert.equal(await page.locator('.text-selection').count(),0,'selection overlay removed after Apply');
  const download=page.waitForEvent('download');if(width<500)await page.locator('#dock-project').click();await page.locator('#save').click();const file=await download,path=join(folder,`saved-${width}.ordo`);await file.saveAs(path);const p=JSON.parse(await readFile(path,'utf8'));
  assert.equal(p.texts[0].opacity,.5);assert.equal(p.texts[0].startTransition.type,'dissolve');assert.equal(p.texts[0].endTransition.type,'wipe-left');assert.ok(p.texts[0].x>.57);assert.ok(Math.abs(p.texts[0].rotation)>10);
  assert.equal(p.clips.find(c=>p.assets.find(a=>a.id===c.assetId).kind==='video').volume,.35);assert.equal(p.clips.find(c=>p.assets.find(a=>a.id===c.assetId).kind==='audio').volume,.65);
  assert.deepEqual(errors,[]);console.log(width+'px: title drag, rotation handle, opacity/transitions, independent video/audio volume and project save passed.');await page.close();
 }
}finally{await browser?.close();await server?.close();await rm(folder,{recursive:true,force:true});}
