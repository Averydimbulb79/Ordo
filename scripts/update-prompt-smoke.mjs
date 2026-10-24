import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
let browser,server;
try{
 server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 for(const mode of ['current','offline','later','download','deferred','download-error']){
  const page=await browser.newPage();await page.addInitScript(mode=>{globalThis.allowed=mode!=='deferred';globalThis.downloads=0;globalThis.updaterMock={async check(){if(mode==='offline')throw Error('Offline');return{available:mode!=='current',version:'0.9.0',versionCode:50,currentVersion:'0.8.0',currentVersionCode:40};},async download(){if(mode==='download-error')throw Error('Browser unavailable');globalThis.downloads++;}};},mode);
  await page.route('**/src/updates.ts',async route=>{const response=await route.fetch();const body=(await response.text()).replace(/const updater = registerPlugin\([^;]+;/,'const updater = globalThis.updaterMock;').replace(/!isAndroid\s*\|\|\s*!Capacitor.isPluginAvailable\(["']OrdoUpdates["']\)/,'false');await route.fulfill({response,body});});
  await page.route('**/blank',route=>route.fulfill({contentType:'text/html',body:'<html><body><script type="module">import{checkStartupUpdate}from"/src/updates.ts";await checkStartupUpdate(()=>globalThis.allowed);globalThis.checked=true;</script></body></html>'}));await page.goto(server.resolvedUrls.local[0]+'blank');await page.waitForFunction(()=>globalThis.checked);
  if(['current','offline'].includes(mode)){assert.equal(await page.locator('.update-dialog').count(),0);}
  else{
   if(mode==='deferred'){assert.equal(await page.locator('.update-dialog').count(),0);await page.evaluate(()=>globalThis.allowed=true);}
   await page.locator('.update-dialog').waitFor({state:'visible'});assert.match(await page.locator('.update-message').innerText(),/0.9.0.*50.*0.8.0.*40/);
   if(mode==='download'||mode==='download-error'){await page.locator('.update-download').click();if(mode==='download-error'){assert.equal(await page.locator('.update-error').innerText(),'Browser unavailable');assert.equal(await page.locator('.update-download').isEnabled(),true);}else{await page.locator('.update-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>globalThis.downloads),1);}}
   else{await page.locator('.update-later').click();await page.locator('.update-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>globalThis.downloads),0);}
  }
  console.log('Startup update: '+mode+' passed.');await page.close();
 }
}finally{await browser?.close();await server?.close();}
