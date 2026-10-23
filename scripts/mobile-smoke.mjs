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
const invalid=join(folder,'broken.mp4');
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
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 const chooser=page.waitForEvent('filechooser');await page.locator('#import-empty').tap();await (await chooser).setFiles(fixture);
 await page.getByRole('dialog',{name:'Project media'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#import-feedback').textContent.includes('1 file imported'));
 assert.match(await page.locator('.media-card').innerText(),/source.webm[\s\S]*Ready to add/);
 if(process.env.ORDO_IMPORT_SCREENSHOT)await page.screenshot({path:process.env.ORDO_IMPORT_SCREENSHOT});
 await page.getByRole('button',{name:'Close media panel'}).tap();
 assert.equal(await page.locator('#empty-heading').innerText(),'Your media is ready');
 assert.match(await page.locator('#empty-description').innerText(),/1 file is in Project media/);
 assert.equal(await page.locator('#import-empty').innerText(),'Choose clips');
 if(process.env.ORDO_READY_SCREENSHOT)await page.screenshot({path:process.env.ORDO_READY_SCREENSHOT});
 await page.locator('#import-empty').tap();await page.getByRole('dialog',{name:'Project media'}).waitFor();
 await page.locator('#media-file').setInputFiles(fixture);
 await page.waitForFunction(()=>document.querySelector('#import-feedback').textContent.includes('already in Project media'));
 assert.equal(await page.locator('.media-card').count(),1,'Duplicate import remains visible without creating another asset');
 const {writeFile}=await import('node:fs/promises');await writeFile(invalid,'This is not a video');
 await page.locator('#media-file').setInputFiles(invalid);
 await page.waitForFunction(()=>document.querySelector('#import-feedback').classList.contains('is-error'));
 assert.match(await page.locator('#import-feedback').innerText(),/broken.mp4/);
 assert.equal(await page.locator('.media-card').count(),1,'Failed import keeps existing media');
 await page.getByRole('button',{name:'Add to sequence'}).tap();
 assert.match(await page.locator('.media-card').innerText(),/In timeline/);
 await page.getByRole('button',{name:'Close media panel'}).tap();
 assert.equal(await page.locator('.clip').count(),1);
 const dock=await page.locator('#mobile-dock').boundingBox();assert.ok(dock.y+dock.height<=844,'Bottom dock is visible without scrolling');
 await page.locator('.clip').tap();
 const cdp=await context.newCDPSession(page);
 const handle=await page.locator('.clip.selected .trim-handle[data-side="out"]').boundingBox();
 const x=handle.x+handle.width/2,y=handle.y+handle.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-32,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.querySelector('#total-time').textContent==='00:00:02:10');
 await page.waitForTimeout(400);await page.locator('#dock-duplicate').tap();await page.waitForFunction(()=>document.querySelectorAll('.clip').length===2);
 const scroll=await page.locator('#timeline-scroll').boundingBox();const cx=scroll.x+scroll.width/2,cy=scroll.y+80;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:cx-35,y:cy},{id:1,x:cx+35,y:cy}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:cx-65,y:cy},{id:1,x:cx+65,y:cy}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(Number(await page.locator('#zoom').inputValue())>48,'Pinch increased timeline zoom');
 await page.locator('#dock-edit').tap();await page.getByRole('dialog',{name:'Clip settings'}).waitFor();await page.getByRole('button',{name:'Close edit panel'}).tap();
 await page.locator('#dock-project').tap();await page.getByRole('dialog',{name:'Project menu'}).waitFor();
 const saved=page.waitForEvent('download');await page.locator('#save').tap();await (await saved).saveAs(join(folder,'mobile.ordo'));
 await page.getByRole('button',{name:'Close project panel'}).tap();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:process.env.ORDO_MOBILE_SCREENSHOT||join(folder,'mobile.png'),fullPage:true});
 await page.setViewportSize({width:844,height:390});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const wideDock=await page.locator('#mobile-dock').boundingBox();assert.ok(wideDock.y+wideDock.height<=390,'Landscape dock remains visible');
 assert.deepEqual(errors,[]);console.log('Mobile touch checks passed: import from empty panel, automatic media sheet, persistent confirmation, choose clips, duplicate/failed import feedback, trim handle, duplicate clip, pinch zoom, project save, portrait and landscape.');
} finally { await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true}); }
