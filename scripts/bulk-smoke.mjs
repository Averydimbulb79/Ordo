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

 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,isMobile:true,hasTouch:true});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#media-file').setInputFiles([fixture,blue]);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===2);
 await page.locator('#add-all-media').tap();assert.equal(await page.locator('.clip').count(),2);
 await page.getByRole('button',{name:'Close media panel'}).tap();
 // A single undo removes the entire bulk insertion.
 await page.evaluate(()=>document.querySelector('#undo').click());assert.equal(await page.locator('.clip').count(),0);
 await page.evaluate(()=>document.querySelector('#redo').click());assert.equal(await page.locator('.clip').count(),2);
 await page.locator('.clip').first().tap();await page.locator('#dock-transitions').tap();
 await page.locator('[data-transition="wipe-left"]').tap();await page.locator('#transition-all').check();await page.locator('#transition-duration').fill('2');await page.locator('.creative-apply').tap();
 await page.locator('.creative-dialog').waitFor({state:'detached'});
 await page.locator('#dock-adjust').tap();await page.locator('#adjust-all').check();
 const slider=async(value)=>page.locator('#adjust-saturation').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input'));},value);
 await slider(-100);
 const checkLayout=async()=>{const a=await page.locator('.adjust-panel').boundingBox(),p=await page.locator('.monitor').boundingBox();assert.ok(a.y>=p.y+p.height-1||a.x>=p.x+p.width-1,`Adjust must not cover preview: ${JSON.stringify({a,p})}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
 await checkLayout();
 const pixel=()=>page.locator('#preview').evaluate(c=>Array.from(c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data));
 await page.waitForTimeout(300);let p=await pixel();assert.ok(Math.abs(p[0]-p[1])<4&&Math.abs(p[1]-p[2])<4,`Adjusted grey: ${p}`);
 await page.locator('#compare-adjustments').tap();p=await pixel();assert.ok(p[0]>180&&p[1]<40,`Original red: ${p}`);assert.match(await page.locator('#compare-adjustments').innerText(),/Original/);
 await page.locator('#play').tap();const before=await page.locator('#current-time').innerText();await slider(-80);await page.waitForTimeout(400);assert.notEqual(await page.locator('#current-time').innerText(),before,'Adjusting must not pause playback');
 await page.locator('#compare-adjustments').tap();assert.equal(await page.locator('#compare-adjustments').getAttribute('aria-pressed'),'false');
 await page.locator('#play').tap();
 await page.setViewportSize({width:844,height:390});await checkLayout();await page.screenshot({path:resolve('../ordo-adjust-landscape.png')});
 await page.setViewportSize({width:390,height:844});await checkLayout();await page.screenshot({path:resolve('../ordo-adjust-portrait.png')});
 await page.locator('.creative-apply').tap();await page.locator('.creative-dialog').waitFor({state:'detached'});
 const saveProject=async()=>{await page.locator('#dock-project').tap();const download=page.waitForEvent('download');await page.locator('#save').tap();const path=join(folder,'bulk.ordo');await(await download).saveAs(path);await page.getByRole('button',{name:'Close project panel'}).tap();return JSON.parse(await readFile(path,'utf8'));};
 let project=await saveProject();assert.ok(project.clips.every(c=>c.adjustments.saturation===-80));assert.equal(project.clips[0].transition,'wipe-left');assert.equal(project.clips[0].transitionFrames,45);
 await page.evaluate(()=>document.querySelector('#undo').click());project=await saveProject();assert.ok(project.clips.every(c=>!c.adjustments));assert.equal(project.clips[0].transition,'wipe-left','Undo grading preserves previous bulk transition');
 await page.evaluate(()=>document.querySelector('#redo').click());
 await page.locator('#dock-adjust').tap();await slider(50);await page.locator('#compare-adjustments').tap();await page.locator('.creative-cancel').tap();await page.locator('.creative-dialog').waitFor({state:'detached'});
 assert.equal(await page.locator('#compare-adjustments').getAttribute('aria-pressed'),'false');project=await saveProject();assert.ok(project.clips.every(c=>c.adjustments.saturation===-80),'Cancel restores saved grades');
 // Desktop docking also reserves the inspector column rather than covering the picture.
 await page.setViewportSize({width:1440,height:960});await page.locator('#tool-adjust').click();await checkLayout();await page.locator('.creative-cancel').click();
 assert.deepEqual(errors,[]);console.log('Bulk and comparison checks passed: add all, one-step undo, all joins with clamping, all video grades, live playback, original pixels, cancel, portrait/landscape/desktop preview layout.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
