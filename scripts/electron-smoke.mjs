import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
const app=await electron.launch({args:['.'],env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'}});
try{
 const page=await app.firstWindow();
 page.on('pageerror',error=>console.error('Renderer error:',error.message));
 await page.waitForSelector('body.windows-desktop #split');
 await page.waitForFunction(()=>innerWidth>1000);
 // Wait for ready-to-show/maximize, then verify work-area rather than exclusive fullscreen.
 await page.waitForTimeout(500);
 const state=await app.evaluate(({BrowserWindow,Menu,screen})=>{const win=BrowserWindow.getAllWindows()[0];return {maximized:win.isMaximized(),fullscreen:win.isFullScreen(),menu:Menu.getApplicationMenu(),bounds:win.getBounds(),workArea:screen.getDisplayMatching(win.getBounds()).workArea};});
 assert.equal(state.maximized,true);assert.equal(state.fullscreen,false);assert.equal(state.menu,null);
 // Windows adds invisible resize margins around maximized windows.
 assert.ok(Math.abs(state.bounds.height-state.workArea.height)<=20,JSON.stringify(state));
 const header=await page.locator('.topbar').evaluate(el=>({padding:parseInt(getComputedStyle(el).paddingRight),region:getComputedStyle(el).getPropertyValue('-webkit-app-region')}));
 assert.ok(header.padding>=138);assert.equal(header.region,'drag');
 assert.equal(await page.locator('#export').evaluate(el=>getComputedStyle(el).getPropertyValue('-webkit-app-region')),'no-drag');
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setContentSize(1260,700);});
 await page.waitForFunction(()=>!!document.querySelector('#desktop-editing-actions #split'));
 assert.ok(await page.locator('.desktop-editbar').isVisible());
 assert.equal(await page.locator('#desktop-editing-actions #split').count(),1);
 console.log('Electron smoke passed: packaged file entry, no app menu, integrated caption controls, maximized work area, draggable header and interactive controls.');
}finally{await app.close();}
