// Requires a Playwright Chromium installation (or CHROMIUM_PATH) and ffmpeg on PATH.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const folder=await mkdtemp(join(tmpdir(),'ordo-smoke-'));
const fixture=join(folder,'red.webm'),blue=join(folder,'blue.webm');
for(const [path,colour,hz] of [[fixture,'red',440],[blue,'blue',880]])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${colour}:s=320x180:r=30${colour==='red'?',drawbox=x=0:y=0:w=30:h=ih:color=white:t=fill':''}`,'-f','lavfi','-i',`sine=frequency=${hz}:sample_rate=48000`,'-t','3','-c:v','libvpx','-b:v','300k','-c:a','libopus',path]);
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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const remote=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))remote.push(r.url());});await page.goto(url);
 await page.locator('#media-file').setInputFiles([fixture,blue]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);
 for(const n of [0,1])await page.locator('.media-card').nth(n).getByRole('button',{name:'Add to sequence'}).click();
 for(const n of [0,1]){await page.locator('.clip').nth(n).click();await page.locator('#trim-out').fill('30');await page.locator('#apply-trim').click();}
 await page.locator('.clip').first().click();
 const seek=async f=>{await page.locator('#scrub').evaluate((el,f)=>{el.value=String(f);el.dispatchEvent(new Event('input'));},f);await page.waitForTimeout(200);};
 await seek(22);await page.locator('#tool-transitions').click();assert.equal(await page.locator('[data-transition]').count(),14);
 const samples=()=>page.locator('#preview').evaluate(c=>{const x=c.getContext('2d');return [[.25,.5],[.75,.5],[.5,.25],[.5,.75],[.5,.5],[.05,.5]].map(([a,b])=>Array.from(x.getImageData(Math.floor(c.width*a),Math.floor(c.height*b),1,1).data));});
 for(const type of ['dissolve','fade-black','fade-white','wipe-left','wipe-right','wipe-up','wipe-down','slide-left','slide-right','push-left','push-right','zoom-in','zoom-out']){
  await page.locator(`[data-transition="${type}"]`).click();await page.waitForTimeout(200);const p=await samples();
  if(type==='dissolve')assert.ok(p[4][0]>80&&p[4][2]>80,`${type}: ${p}`);
  if(type==='fade-black')assert.ok(p[4][0]<60&&p[4][2]<60,`${type}: ${p}`);
  if(type==='fade-white')assert.ok(p[4].slice(0,3).reduce((a,b)=>a+b)>650,`${type}: ${p}`);
  if(['wipe-left','slide-left','push-left'].includes(type))assert.ok(p[0][0]>180&&p[1][2]>180,`${type}: ${p}`);
  if(['wipe-right','slide-right','push-right'].includes(type))assert.ok(p[0][2]>180&&p[1][0]>180,`${type}: ${p}`);
  if(type==='wipe-up')assert.ok(p[2][0]>180&&p[3][2]>180,`${type}: ${p}`);
  if(type==='zoom-out')assert.ok(p[5][2]>180&&p[5][0]<40,`Zoom out shrinks the outgoing picture: ${p}`);
  if(type==='wipe-down')assert.ok(p[2][2]>180&&p[3][0]>180,`${type}: ${p}`);
 }
 await page.locator('[data-transition="wipe-left"]').click();await page.locator('.creative-apply').click();
 assert.equal(await page.locator('#total-time').innerText(),'00:00:01:15');
 await page.locator('.clip').first().click();await page.locator('#tool-adjust').click();assert.equal(await page.locator('.adjust-row').count(),11);
 for(const [key,value] of [['saturation',-100],['brightness',20],['vignette',60],['sharpen',15],['shadows',10]])await page.locator(`#adjust-${key}`).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input'));},value);
 await page.waitForTimeout(400);let p=await samples();assert.ok(p[4][0]>30&&p[4][0]<150&&Math.abs(p[4][0]-p[4][1])<3&&Math.abs(p[4][1]-p[4][2])<3,`Grading desaturates: ${p}`);await page.locator('.creative-apply').click();
 await page.locator('#tool-title').click();await page.locator('#text-content').fill('ORDO TITLE');await page.locator('#text-start').fill('0');await page.locator('#text-duration').fill('1.5');await page.locator('#text-font').selectOption('Montserrat');await page.locator('#text-size').fill('64');await page.locator('#text-color').evaluate(el=>{el.value='#00ff00';el.dispatchEvent(new Event('input'));});await page.locator('#text-rotation').fill('15');
 for(const style of ['bold','italic','underline','strike'])if(await page.locator(`[data-style="${style}"]`).getAttribute('aria-pressed')!=='true')await page.locator(`[data-style="${style}"]`).click();
 await page.locator('.creative-apply').click();await page.waitForFunction(()=>document.fonts.check('italic 700 64px "Montserrat"'));
 await page.locator('#tool-captions').click();await page.locator('#text-content').fill('Caption line');await page.locator('#text-start').fill('.25');await page.locator('#text-duration').fill('.75');await page.locator('#text-size').fill('34');await page.locator('.creative-apply').click();
 await page.locator('#tool-captions').click();const srtDownload=page.waitForEvent('download');await page.locator('#export-captions').click();const srtFile=join(folder,'captions.srt');await(await srtDownload).saveAs(srtFile);assert.match(await readFile(srtFile,'utf8'),/Caption line/);
 const extra=join(folder,'extra.vtt');await writeFile(extra,'WEBVTT\n\n00:00.800 --> 00:01.200\nImported caption');await page.locator('#caption-file').setInputFiles(extra);await page.locator('.creative-dialog').waitFor({state:'detached'});
 await page.locator('#tool-crop').click();await page.locator('#crop-canvas[data-ready="true"]').waitFor();await page.locator('#crop-ratio').selectOption('1:1');const oldWidth=Number(await page.locator('#crop-width').inputValue());assert.ok(oldWidth<100);
 await page.locator('#crop-ratio').selectOption('free');const rect=await page.locator('#crop-canvas').boundingBox();const x=Number(await page.locator('#crop-x').inputValue())/100,w=oldWidth/100;
 await page.mouse.move(rect.x+(x+w)*rect.width-2,rect.y+rect.height-2);await page.mouse.down();await page.mouse.move(rect.x+(x+w)*rect.width-35,rect.y+rect.height-30,{steps:5});await page.mouse.up();assert.ok(Number(await page.locator('#crop-width').inputValue())<oldWidth,'Free-size corner drag changes width');
 await page.locator('#crop-ratio').selectOption('9:16');await page.locator('#crop-match').check();await page.locator('.creative-apply').click();assert.match(await page.locator('#program-settings').innerText(),/720 × 1280/);
 const save=page.waitForEvent('download');await page.locator('#save').click();const projectFile=join(folder,'creative.ordo');await(await save).saveAs(projectFile);const project=JSON.parse(await readFile(projectFile,'utf8'));
 assert.equal(project.version,3);assert.equal(project.texts.length,3);assert.ok(project.texts[0].bold&&project.texts[0].italic&&project.texts[0].underline&&project.texts[0].strike);assert.equal(project.clips[0].transition,'wipe-left');assert.equal(project.clips[0].adjustments.saturation,-100);assert.ok(project.clips[0].crop.width<1);
 await page.locator('#compare-adjustments').click();assert.equal(await page.locator('#compare-adjustments').getAttribute('aria-pressed'),'true');
 // Export the actual creative edit at two frame rates and verify container dimensions and decoded pixels.
 for(const fps of [60,24]){
  await page.locator('#export').click();await page.locator('#format').selectOption('webm');await page.locator('#export-resolution').selectOption('480');await page.locator('#export-fps').selectOption(String(fps));await page.locator('#export-quality').selectOption('compact');await page.waitForFunction(()=>!document.querySelector('#start-export').disabled);
  assert.match(await page.locator('#export-description').innerText(),new RegExp(`480 × 854 · ${fps} fps`));
  const rendered=page.waitForEvent('download',{timeout:180000});await page.locator('#start-export').click();const output=join(folder,`creative-${fps}.webm`);await(await rendered).saveAs(output);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames,width,height,r_frame_rate','-of','json',output],{encoding:'utf8'}));const video=info.streams.find(s=>s.codec_type==='video');assert.equal(video.width,480);assert.equal(video.height,854);assert.equal(video.r_frame_rate,`${fps}/1`);assert.equal(Number(video.nb_read_frames),fps*1.5);
  if(fps===60){const raw=execFileSync('ffmpeg',['-v','error','-i',output,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:2000000});let green=0;for(let i=0;i<raw.length;i+=3)if(raw[i+1]>100&&raw[i+1]>raw[i]+40&&raw[i+1]>raw[i+2]+40)green++;assert.ok(green>100,'Styled green title is baked into exported picture');const grade=Array.from(raw.subarray((100*480+240)*3,(100*480+240)*3+3));assert.ok(grade[0]>10&&Math.abs(grade[0]-grade[1])<7&&Math.abs(grade[1]-grade[2])<7,`Grading is baked into export: ${grade}`);const croppedEdge=raw[(400*480+24)*3];assert.ok(croppedEdge<120,'Centre portrait crop removes the bright stripe at the original left edge');}
  execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);await page.locator('#close-export').click();
 }
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.body.classList.contains('mobile-ui'));for(const id of ['transitions','title','captions','adjust','crop']){const r=await page.locator('#dock-'+id).boundingBox();assert.ok(r&&r.y+r.height<=844,`${id} button visible`);}
 await page.locator('#dock-title').click();await page.getByRole('dialog',{name:'Title',exact:true}).waitFor();if(process.env.ORDO_CREATIVE_SCREENSHOT)await page.screenshot({path:process.env.ORDO_CREATIVE_SCREENSHOT});await page.locator('.creative-cancel').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const empty=await browser.newPage({viewport:{width:390,height:844}});empty.on('pageerror',e=>errors.push(e.message));await empty.goto(url);await empty.locator('#dock-title').click();await empty.locator('#text-content').fill('Title before footage');await empty.waitForFunction(()=>document.querySelector('#preview-empty').hidden);await empty.locator('.creative-cancel').click();await empty.locator('.creative-dialog').waitFor({state:'detached'});assert.equal(await empty.locator('#preview-empty').isVisible(),true,'Cancelling a title-only draft restores the empty prompt');await empty.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[],'Google fonts load from the bundled app only');
 console.log('Creative checks passed: 13 transition previews, 11 adjustments, styled offline Google-font title, captions/SRT/VTT, crop presets/free resize, project persistence, portrait 480p exports at 60/24 fps, baked text and decoded output, mobile tool buttons.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
