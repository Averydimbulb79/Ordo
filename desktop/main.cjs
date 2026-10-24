const {app,BrowserWindow,Menu,shell}=require('electron');
const path=require('node:path');
function createWindow(){
 const win=new BrowserWindow({
  width:1600,height:950,minWidth:1050,minHeight:650,
  backgroundColor:'#111318',show:false,autoHideMenuBar:true,
  titleBarStyle:'hidden',
  titleBarOverlay:{color:'#16191f',symbolColor:'#dce1e8',height:46},
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
 });
 win.loadFile(path.join(__dirname,'../dist/index.html'));
 // Maximizing uses the Windows work area, leaving the taskbar available.
 win.once('ready-to-show',()=>{win.maximize();win.show();});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(url.startsWith('https://'))shell.openExternal(url);
  return {action:'deny'};
 });
}
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 createWindow();
 app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
