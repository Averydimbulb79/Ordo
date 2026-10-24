import { Capacitor,registerPlugin } from '@capacitor/core';
import { isAndroid } from './native';
const updater=registerPlugin<{check():Promise<{available:boolean;version?:string;versionCode?:number;currentVersion?:string;currentVersionCode?:number}>;download():Promise<void>}>('OrdoUpdates');
export async function checkStartupUpdate(canPrompt:()=>boolean){
 if(!isAndroid||!Capacitor.isPluginAvailable('OrdoUpdates'))return;
 try{
  const release=await updater.check();if(!release.available||!release.version)return;
  // Defer a prompt if the user has already started exporting or opened a panel.
  const show=()=>{
   if(document.hidden||!canPrompt()||document.querySelector('dialog[open],.sheet-open')){setTimeout(show,2000);return;}
   const dialog=document.createElement('dialog');dialog.className='update-dialog';dialog.setAttribute('aria-label','Ordo update available');
   dialog.innerHTML='<div class="dialog-head"><h2>Update available</h2><button aria-label="Close update prompt">×</button></div><p class="update-message"></p><p class="note">Save your project before updating. Android will ask you to install the downloaded APK over this app.</p><p class="update-error" role="alert"></p><div class="dialog-actions"><button class="update-later">Later</button><button class="update-download accent">Download update</button></div>';
   dialog.querySelector('.update-message')!.textContent=`Ordo v${release.version} (build ${release.versionCode}) is available. You have v${release.currentVersion} (build ${release.currentVersionCode}).`;
   dialog.querySelector('.dialog-head button')!.addEventListener('click',()=>dialog.close());dialog.querySelector('.update-later')!.addEventListener('click',()=>dialog.close());
   dialog.querySelector<HTMLButtonElement>('.update-download')!.onclick=async()=>{const button=dialog.querySelector<HTMLButtonElement>('.update-download')!;button.disabled=true;try{await updater.download();dialog.close();}catch(error){dialog.querySelector('.update-error')!.textContent=error instanceof Error?error.message:String(error);button.disabled=false;}};
   dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  };show();
 }catch{/* Offline, missing or malformed release data never blocks startup. */}
}
