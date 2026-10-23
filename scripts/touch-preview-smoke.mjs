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


 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,isMobile:true,hasTouch:true});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#media-file').setInputFiles(fixture);await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===1);
 await page.locator('#add-all-media').tap();await page.getByRole('button',{name:'Close media panel'}).tap();
 await page.locator('.clip').first().tap();
 const rows=await page.locator('#track-labels .track-label').evaluateAll(els=>els.map(e=>({height:e.getBoundingClientRect().height,top:parseFloat(e.style.top)})));
 assert.deepEqual(rows.map(e=>e.height),[52,52,52,52,52,52]);assert.deepEqual(rows.map(e=>e.top),[0,52,104,156,208,260]);
 assert.equal(await page.locator('.clip').evaluate(e=>e.getBoundingClientRect().height),44);
 await page.locator('#dock-adjust').tap();
 const cdp=await page.context().newCDPSession(page);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
 const values=()=>page.locator('.adjust-row input').evaluateAll(els=>els.map(e=>e.value));
 const slider=page.locator('#adjust-brightness'),rect=await slider.boundingBox();
 await page.touchscreen.tap(rect.x+rect.width*.9,rect.y+rect.height/2);
 assert.equal(await slider.inputValue(),'0','Tapping a distant point must not jump the value');
 const before=await values(),x=rect.x+rect.width*.6,y=rect.y+rect.height/2;
 await touch('touchStart',x,y);
 for(let n=1;n<=6;n++){await touch('touchMove',x+1,y-n*15);await page.waitForTimeout(25);}
 await touch('touchEnd');await page.waitForTimeout(200);
 assert.deepEqual(await values(),before,'Vertical scrolling over a slider must preserve all grades');
 assert.ok(await page.locator('.adjust-panel .creative-body').evaluate(e=>e.scrollTop)>20,'Vertical swipe must actually scroll the panel');
 await page.locator('.adjust-panel .creative-body').evaluate(e=>e.scrollTop=0);
 const r=await slider.boundingBox(),sx=r.x+r.width*.65,sy=r.y+r.height/2;
 await touch('touchStart',sx,sy);
 for(let n=1;n<=5;n++)await touch('touchMove',sx+n*8,sy);
 await touch('touchEnd');
 const adjusted=Number(await slider.inputValue());assert.ok(adjusted>0&&adjusted<25,`Sideways dragging changes relative to the original value, with finer sensitivity: ${adjusted}`);
 await slider.focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await slider.inputValue()),adjusted+1,'Keyboard arrows still adjust one step');
 await page.locator('.creative-apply').tap();await page.locator('.creative-dialog').waitFor({state:'detached'});
 const screen=await page.locator('.screen').boundingBox(),icon=await page.locator('#preview-fullscreen').boundingBox();assert.ok(icon.x>screen.x+screen.width/2&&icon.y>screen.y+screen.height/2,'Fullscreen icon sits at bottom right of picture');
 await page.locator('#play').tap();await page.locator('#preview-fullscreen').tap();await page.waitForFunction(()=>document.body.classList.contains('preview-expanded'));
 await page.keyboard.press('Delete');assert.equal(await page.locator('.clip').count(),1,'Fullscreen keyboard input cannot delete editing clips');
 assert.equal(await page.locator('#preview-fullscreen').getAttribute('aria-label'),'Exit fullscreen preview');
 assert.equal(await page.locator('.monitor').evaluate(e=>Math.round(e.getBoundingClientRect().height)),844);
 await page.locator('#play').tap();const time=await page.locator('#current-time').innerText();await page.waitForTimeout(200);assert.equal(await page.locator('#current-time').innerText(),time,'Fullscreen pause control works');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenWidth:844,screenHeight:390,screenOrientation:{type:'landscapePrimary',angle:90}});await page.waitForTimeout(200);
 assert.equal(await page.locator('.monitor').evaluate(e=>Math.round(e.getBoundingClientRect().width)),844);
 // Back exits preview, preserving the edit and returning to compact lanes.
 await page.evaluate(()=>window.dispatchEvent(new Event('ordo-back')));await page.waitForFunction(()=>!document.body.classList.contains('preview-expanded'));
 assert.equal(await page.locator('.clip').count(),1);assert.equal(await page.locator('#dock-media').evaluate(e=>e.inert),false);
 await page.setViewportSize({width:390,height:844});
 // The in-window fallback also exits with Escape if Fullscreen API is unavailable.
 await page.locator('.monitor').evaluate(e=>e.requestFullscreen=()=>Promise.reject(new Error('Unavailable')));
 await page.locator('#preview-fullscreen').tap();await page.waitForFunction(()=>document.body.classList.contains('preview-expanded'));
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:resolve('../ordo-fullscreen-landscape.png')});
 const controls=await page.locator('#preview-fullscreen').boundingBox(),compare=await page.locator('.compare-bar').boundingBox();assert.ok(compare.y+compare.height<controls.y,'Fullscreen comparison must not cover the exit icon');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('preview-expanded'));await page.setViewportSize({width:390,height:844});

 await page.locator('#export').tap();await page.locator('#format').selectOption('mp4-hevc');await page.locator('#export-resolution').selectOption('480');await page.locator('#export-fps').selectOption('24');
 await page.waitForFunction(()=>!document.querySelector('#format-status').textContent.startsWith('Checking'));
 assert.equal(await page.locator('#format').inputValue(),'mp4-hevc','Codec selection must not silently fall back to H.264');
 if(await page.locator('#start-export').isEnabled()){
  const download=page.waitForEvent('download',{timeout:180000});await page.locator('#start-export').tap();const file=await download;assert.ok(file.suggestedFilename().endsWith('.mp4'));
  const output=join(folder,'hevc.mp4');await file.saveAs(output);const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8'})).streams;
  assert.equal(streams.find(s=>s.codec_type==='video').codec_name,'hevc');assert.equal(streams.find(s=>s.codec_type==='audio').codec_name,'aac');execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);console.log('Actual H.265 / AAC output decoded successfully.');
 }else{
  assert.match(await page.locator('#format-status').innerText(),/H\.265 \(HEVC\).*unavailable/);console.log('H.265 encoder unavailable on this test host; unsupported export is correctly blocked.');
 }
 await page.locator('#close-export').tap();
 assert.deepEqual(errors,[]);console.log('Touch and preview checks passed: slider tap protection, real vertical swipe without grade changes, fine horizontal drag and keyboard control, compact six lanes, fullscreen transport, portrait/landscape, Back and fallback Escape.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
