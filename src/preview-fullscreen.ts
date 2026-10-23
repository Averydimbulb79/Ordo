import { isAndroid, previewMode } from './native';

export function setupPreviewFullscreen(hooks:{beforeEnter:()=>void;report:(message:string)=>void}){
 const monitor=document.querySelector<HTMLElement>('.monitor')!,button=document.getElementById('preview-fullscreen')!;
 let expanded=false,pending=false,focus:HTMLElement|null=null;
 let locked:HTMLElement[]=[];
 const setExpanded=(value:boolean)=>{
  expanded=value;document.body.classList.toggle('preview-expanded',value);
  button.setAttribute('aria-pressed',String(value));const label=value?'Exit fullscreen preview':'Fullscreen preview';
  button.setAttribute('aria-label',label);button.title=label;
  button.querySelector('path')!.setAttribute('d',value?'M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5':'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5');
  if(value){
   locked=[];
   for(const element of document.querySelectorAll<HTMLElement>('.topbar,.toolbar,#mobile-dock,.statusbar,.workspace > :not(.monitor),body > .creative-dialog'))if(!element.inert){element.inert=true;locked.push(element);}
   button.focus();
  }else{for(const element of locked)element.inert=false;locked=[];focus?.focus();}
 };
 const exit=async()=>{
  if(!expanded||pending)return;
  pending=true;
  try{
   if(isAndroid)await previewMode(false);
   else if(document.fullscreenElement===monitor)await document.exitFullscreen();
  }catch(error){hooks.report(error instanceof Error?error.message:String(error));}
  finally{setExpanded(false);pending=false;}
 };
 const enter=async()=>{
  if(expanded||pending)return;
  hooks.beforeEnter();focus=document.activeElement as HTMLElement;setExpanded(true);pending=true;
  try{
   if(isAndroid)await previewMode(true);
   else{
    if(document.fullscreenElement&&document.fullscreenElement!==monitor)await document.exitFullscreen();
    try{await monitor.requestFullscreen({navigationUI:'hide'});}catch{hooks.report('Preview expanded to the browser window.');}
    // Do not lock landscape: the preview should follow portrait and landscape rotation.
    if(document.fullscreenElement===monitor)try{screen.orientation?.unlock();}catch{/* Some browsers manage orientation themselves. */}
   }
  }catch(error){hooks.report(error instanceof Error?error.message:String(error));}
  finally{pending=false;}
 };
 button.onclick=()=>{void(expanded?exit():enter());};
 document.addEventListener('fullscreenchange',()=>{if(expanded&&!isAndroid&&!document.fullscreenElement&&!pending)setExpanded(false);});
 document.addEventListener('keydown',event=>{
  if(expanded&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();void exit();}
 },true);
 return{active:()=>expanded,exit};
}
