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
  const cdp=width<500?await page.context().newCDPSession(page):null;
  const drag=async(x,y,toX,toY)=>{if(!cdp){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(toX,toY,{steps:8});await page.mouse.up();return;}const point=(a,b)=>[{x:a,y:b,id:1,radiusX:4,radiusY:4,force:1}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(x,y)});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(x+(toX-x)*i/8,y+(toY-y)*i/8)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  const openEdit=async()=>{if(width<500)await page.locator('#dock-edit').click();};
  await page.locator('.clip.video').first().click();await openEdit();
  await page.locator('#volume').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#apply-source-volume-all').click();
  if(width<500)await page.locator('.sheet-close').filter({visible:true}).first().click();
  await page.locator('.clip.audio').first().click();await openEdit();await page.locator('#volume').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#apply-source-volume-all').click();
  if(width<500)await page.locator('.sheet-close').filter({visible:true}).first().click();
  await page.locator(width<500?'#dock-title':'#tool-title').click();await page.locator('#text-content').fill('Move this title');await page.locator('#text-font').selectOption('Montserrat');await page.waitForFunction(()=>document.fonts.check('normal 700 48px "Montserrat"'));await page.locator('#text-duration').fill('');assert.notEqual(await page.locator('.creative-error').innerText(),'');await page.locator('#text-duration').fill('3');
  const canvas=page.locator('#preview');
  const centre=await canvas.evaluate(async c=>{const {textBounds,}=await import('/src/text-renderer.ts');const {previewPoint}=await import('/src/text-transform.ts');const {newText}=await import('/src/creative-model.ts');const t={...newText('title',0),fontFamily:'Montserrat',text:'Move this title'},b=textBounds(c.getContext('2d'),t),p=previewPoint(c,0,0);return{x:p.left+(t.x*c.width+b.x+b.width/2)*p.scale,y:p.top+(t.y*c.height+b.y+b.height/2)*p.scale,dx:c.width*p.scale*.1,dy:c.height*p.scale*.1};});
  await drag(centre.x,centre.y,centre.x+centre.dx,centre.y+centre.dy);
  assert.ok(Number(await page.locator('#text-x').inputValue())>57,'drag changes x');assert.ok(Number(await page.locator('#text-y').inputValue())>57,'drag changes y');
  const rotate=await page.locator('.text-rotate').boundingBox();await drag(rotate.x+rotate.width/2,rotate.y+rotate.height/2,rotate.x+rotate.width/2+55,rotate.y+rotate.height/2+35);assert.ok(Math.abs(Number(await page.locator('#text-rotation').inputValue()))>10,'rotation handle changes angle');
  const beforeSize=Number(await page.locator('#text-size').inputValue()),corner=await page.locator('.text-resize[data-corner=se]').boundingBox();
  const anchor=await page.locator('.text-selection').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y};});
  await drag(corner.x+12,corner.y+12,anchor.x+(corner.x+12-anchor.x)*1.3,anchor.y+(corner.y+12-anchor.y)*1.3);assert.ok(Number(await page.locator('#text-size').inputValue())>beforeSize,'corner resizes rotated text');
  await page.locator('#text-opacity').evaluate(el=>{el.value='50';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#text-start-effect').selectOption('dissolve');await page.locator('#text-end-effect').selectOption('wipe-left');await page.locator('.creative-apply').click();
  await page.locator('.text-selection').waitFor({state:'detached'});assert.equal(await page.locator('.text-selection').count(),0,'selection overlay removed after Apply');
  const pixels=await page.evaluate(async()=>{const {paintAnimatedText}=await import('/src/text-renderer.ts'),{newText}=await import('/src/creative-model.ts');const c=document.createElement('canvas');c.width=400;c.height=200;const ctx=c.getContext('2d'),item={...newText('title',0),text:'Fade',outline:false,opacity:.5,startTransition:{type:'dissolve',frames:15},endTransition:{type:'wipe-left',frames:15}};return [0,45,89].map(offset=>{ctx.clearRect(0,0,400,200);paintAnimatedText(ctx,item,1,offset);const d=ctx.getImageData(0,0,400,200).data;let max=0,count=0;for(let i=3;i<d.length;i+=4){max=Math.max(max,d[i]);if(d[i])count++;}return{max,count};});});assert.equal(pixels[0].count,0);assert.ok(pixels[1].max>=126&&pixels[1].max<=128);assert.ok(pixels[2].count<pixels[1].count);
  const title=page.locator('.text-clip').first();await title.scrollIntoViewIfNeeded();const timelineTitle=await title.boundingBox(),step=Number(await page.locator('#zoom').inputValue());await drag(timelineTitle.x+20,timelineTitle.y+20,timelineTitle.x+20+step,timelineTitle.y+20);await page.waitForFunction(()=>!document.querySelector('.creative-dialog[open]'));
  const end=await page.locator('.text-clip .text-trim-handle[data-side=out]').first().boundingBox();await drag(end.x+end.width/2,end.y+20,end.x+end.width/2+step,end.y+20);
  const begin=await page.locator('.text-clip .text-trim-handle[data-side=in]').first().boundingBox();await drag(begin.x+begin.width/2,begin.y+20,begin.x+begin.width/2-step/2,begin.y+20);
  const still=page.locator('.clip.image').first();await still.scrollIntoViewIfNeeded();const imageEnd=await still.locator('.trim-handle[data-side=out]').boundingBox();await drag(imageEnd.x+imageEnd.width/2,imageEnd.y+20,imageEnd.x+imageEnd.width/2+step,imageEnd.y+20);
  const download=page.waitForEvent('download');if(width<500)await page.locator('#dock-project').click();await page.locator('#save').click();const file=await download,path=join(folder,`saved-${width}.ordo`);await file.saveAs(path);const p=JSON.parse(await readFile(path,'utf8'));
  assert.equal(p.texts[0].fontFamily,'Montserrat');assert.equal(p.texts[0].startFrame,15,'left edge extends title earlier');assert.equal(p.texts[0].frames,135,'both title edges extend duration');assert.ok(p.texts[0].fontSize>72);assert.equal(p.clips.find(c=>p.assets.find(a=>a.id===c.assetId).kind==='image').frames,210,'image edge extends duration');assert.equal(p.texts[0].opacity,.5);assert.equal(p.texts[0].startTransition.type,'dissolve');assert.equal(p.texts[0].endTransition.type,'wipe-left');assert.ok(p.texts[0].x>.57);assert.ok(Math.abs(p.texts[0].rotation)>10);
  assert.equal(p.clips.find(c=>p.assets.find(a=>a.id===c.assetId).kind==='video').volume,.35);assert.equal(p.clips.find(c=>p.assets.find(a=>a.id===c.assetId).kind==='audio').volume,.65);
  assert.deepEqual(errors,[]);console.log(width+'px: title drag/rotation, opacity/transition pixels, timeline dragging, independent video/audio volume and project save passed.');await page.close();
 }
}finally{await browser?.close();await server?.close();await rm(folder,{recursive:true,force:true});}
