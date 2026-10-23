import { isAndroid } from './native';

type Hooks = {
 isBusy: () => boolean;
 seek: (frame: number) => void;
 getScale: () => number;
 setScale: (scale: number) => void;
 trimRange: (id: string) => { inFrame: number; outFrame: number; sourceFrames: number } | null;
 commitTrim: (id: string, inFrame: number, outFrame: number) => void;
};
export function setupMobile(hooks: Hooks) {
 const $ = (id: string) => document.getElementById(id)!;
 const toolbar = document.querySelector<HTMLElement>('.toolbar')!;
 const anchor = document.createComment('desktop toolbar'); toolbar.before(anchor);
 const projectPanel = document.createElement('section'); projectPanel.id = 'mobile-project-panel'; projectPanel.className = 'panel project-panel';
 projectPanel.innerHTML = '<div class="panel-heading"><h2>Project</h2></div><p class="mobile-project-note">Save your edit as an .ordo project. Keep your original media for reopening.</p>';
 document.body.append(projectPanel);
 const backdrop = document.createElement('button'); backdrop.id = 'sheet-backdrop'; backdrop.setAttribute('aria-label', 'Close editing panel'); backdrop.hidden = true; document.body.append(backdrop);
 const dock = document.createElement('nav'); dock.id = 'mobile-dock'; dock.setAttribute('aria-label','Editing tools');
 const dockIcon=(path:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
 dock.innerHTML = `<button id="dock-media" aria-label="Media">${dockIcon('M12 4v16M4 12h16')}Media</button><button id="dock-edit" aria-label="Clip settings">${dockIcon('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 10v7M12 6v1')}Edit</button><button id="dock-split" aria-label="Split selected clip">${dockIcon('M12 3v18M4 7l5 5-5 5m16-10-5 5 5 5')}Split</button><button id="dock-duplicate" aria-label="Duplicate selected clip">${dockIcon('M8 8h13v13H8V8ZM3 16V3h13')}Duplicate</button><button id="dock-project" aria-label="Project menu">${dockIcon('M3 5h7l2 3h9v13H3V5Z')}Project</button>`;
 const creativeIcons:Record<string,string>={transitions:'M3 4h8v16H3V4Zm10 0h8v16h-8',title:'M4 5h16M12 5v15M8 20h8',captions:'M3 5h18v14H3V5Zm3 5h4m-4 4h4m4-4h4m-4 4h4',adjust:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M9 15v6',crop:'M7 3v14h14M3 7h14v14'};
 for(const [kind,label] of [['transitions','Transitions'],['title','Title'],['captions','Captions'],['crop','Crop'],['adjust','Adjust']]){const button=document.createElement('button');button.id='dock-'+kind;button.innerHTML=dockIcon(creativeIcons[kind]);button.append(document.createTextNode(label));button.setAttribute('aria-label',label);dock.append(button);}
 $('app').insertBefore(dock,document.querySelector('.statusbar'));
 const panels: Record<string, HTMLElement> = { media: document.querySelector('.media-panel')!, edit: document.querySelector('.inspector')!, project: projectPanel };
 let active = '', restoreFocus: HTMLElement | null = null;
 for (const [name,panel] of Object.entries(panels)) {
  panel.classList.add('mobile-sheet'); panel.dataset.sheet = name;
  const heading = panel.querySelector('.panel-heading')!;
  const close = document.createElement('button'); close.className='sheet-close'; close.type='button'; close.textContent='Done'; close.setAttribute('aria-label',`Close ${name} panel`); close.onclick=()=>closeSheet(); heading.append(close);
 }
 const guide=document.createElement('button');guide.id='mobile-guide';guide.textContent='Quick guide';guide.onclick=()=>$('help').click();projectPanel.append(guide);
 const importButton = document.createElement('button'); importButton.id='mobile-import'; importButton.textContent='Import media'; importButton.className='accent mobile-import';
 importButton.onclick=()=>{if(!hooks.isBusy())$('import').click();}; panels.media.insertBefore(importButton,panels.media.querySelector('.media-list'));
 function closeSheet() {
  if (!active) return false;
  panels[active].classList.remove('sheet-open');panels[active].removeAttribute('role');panels[active].removeAttribute('aria-modal');
  active='';backdrop.hidden=true;document.body.classList.remove('sheet-visible');restoreFocus?.focus();return true;
 }
 function showSheet(name: string) {
  closeSheet();restoreFocus=document.activeElement as HTMLElement;active=name;backdrop.hidden=false;panels[name].classList.add('sheet-open');panels[name].setAttribute('role','dialog');panels[name].setAttribute('aria-modal','true');panels[name].setAttribute('aria-label',name==='media'?'Project media':name==='edit'?'Clip settings':'Project menu');document.body.classList.add('sheet-visible');
  panels[name].querySelector<HTMLElement>('button')?.focus();
 }
 backdrop.onclick=()=>closeSheet();
 function activate(id:string,action:()=>void){
  const element=$(id);let lastTouch=-Infinity;
  element.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse'&&!(element as HTMLButtonElement).disabled){event.preventDefault();lastTouch=performance.now();action();}});
  element.onclick=event=>{if(performance.now()-lastTouch<500){event.preventDefault();return;}action();};
 }
 activate('dock-media',()=>showSheet('media'));activate('dock-edit',()=>showSheet('edit'));activate('dock-project',()=>showSheet('project'));
 for(const kind of ['transitions','title','captions','adjust','crop'])activate('dock-'+kind,()=>{if(!hooks.isBusy())$('tool-'+kind).click();});
 activate('dock-split',()=>{if(!hooks.isBusy())$('split').click();});activate('dock-duplicate',()=>{if(!hooks.isBusy())$('duplicate').click();});
 const updateDock=()=>{
  ($('dock-split') as HTMLButtonElement).disabled=($('split') as HTMLButtonElement).disabled;
  ($('dock-duplicate') as HTMLButtonElement).disabled=($('duplicate') as HTMLButtonElement).disabled;
  importButton.disabled=hooks.isBusy();
 };
 new MutationObserver(updateDock).observe($('split'),{attributes:true,attributeFilter:['disabled']});
 new MutationObserver(updateDock).observe($('duplicate'),{attributes:true,attributeFilter:['disabled']});updateDock();
 const query=matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1100px)');
 const updateLayout=()=>{
  const mobile=isAndroid||query.matches;document.body.classList.toggle('mobile-ui',mobile);
  if(mobile)projectPanel.append(toolbar);else{closeSheet();anchor.parentNode!.insertBefore(toolbar,anchor.nextSibling);}
 };
 query.addEventListener('change',updateLayout);updateLayout();
 document.addEventListener('keydown',event=>{
  if(!active||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeSheet();return;}
  if(event.key==='Tab'){
   const focusable=Array.from(panels[active].querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')).filter(e=>e.getClientRects().length);
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 },true);
 // Trim handles commit a single undo step after the finger is released.
 const scroll=$('timeline-scroll'),content=$('timeline-content');
 const pointers=new Map<number,{x:number;y:number}>();
 let startX=0,startY=0,startScrollTop=0,startScroll=0,pinchDistance=0,pinchScale=0,pinchFrame=0,mode:'pan'|'seek'|'trim'|'pinch'|''='';
 let suppressUntil=0;
 scroll.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 let drag: { id:string;side:string;inFrame:number;outFrame:number;sourceFrames:number;nextIn:number;nextOut:number;scale:number;node:HTMLElement;left:number;width:number } | null=null;
 const pointDistance=()=>{const [a,b]=Array.from(pointers.values());return Math.hypot(a.x-b.x,a.y-b.y);};
 scroll.addEventListener('pointerdown',event=>{
  if(!document.body.classList.contains('mobile-ui')||hooks.isBusy()||event.pointerType==='mouse')return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});scroll.setPointerCapture(event.pointerId);
  if(pointers.size===2){
   if(drag){drag.node.style.left=`${drag.left}px`;drag.node.style.width=`${drag.width}px`;drag=null;}
   mode='pinch';pinchDistance=pointDistance();pinchScale=hooks.getScale();
   const rect=scroll.getBoundingClientRect(),center=Array.from(pointers.values()).reduce((n,p)=>n+p.x,0)/2;
   pinchFrame=(scroll.scrollLeft+center-rect.left-56)/pinchScale;return;
  }
  startX=event.clientX;startY=event.clientY;startScrollTop=scroll.scrollTop;startScroll=scroll.scrollLeft;
  const target=event.target as HTMLElement,handle=target.closest<HTMLElement>('.trim-handle');
  if(handle){const node=handle.closest<HTMLElement>('.clip')!,id=node.dataset.id!,range=hooks.trimRange(id);if(!range)return;
   drag={id,side:handle.dataset.side!,...range,nextIn:range.inFrame,nextOut:range.outFrame,scale:hooks.getScale(),node,left:parseFloat(node.style.left),width:parseFloat(node.style.width)};mode='trim';event.preventDefault();
  }else mode=target.closest('.ruler')?'seek':'pan';
 });
 scroll.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(mode==='pinch'&&pointers.size>=2){
   event.preventDefault();const scale=Math.max(12,Math.min(120,pinchScale*pointDistance()/Math.max(1,pinchDistance)));hooks.setScale(scale);
   const center=Array.from(pointers.values()).reduce((n,p)=>n+p.x,0)/pointers.size;scroll.scrollLeft=56+pinchFrame*scale-(center-scroll.getBoundingClientRect().left);return;
  }
  if(mode==='trim'&&drag){
   event.preventDefault();const delta=Math.round((event.clientX-startX)/drag.scale*30);
   if(drag.side==='in')drag.nextIn=Math.max(0,Math.min(drag.outFrame-1,drag.inFrame+delta));else drag.nextOut=Math.min(drag.sourceFrames,Math.max(drag.inFrame+1,drag.outFrame+delta));
   drag.node.style.width=`${Math.max(2,(drag.nextOut-drag.nextIn)/30*drag.scale)}px`;return;
  }
  if(mode==='seek'){event.preventDefault();hooks.seek((event.clientX-content.getBoundingClientRect().left-56)/hooks.getScale()*30);}
  else if(mode==='pan'){event.preventDefault();scroll.scrollLeft=startScroll-(event.clientX-startX);scroll.scrollTop=startScrollTop-(event.clientY-startY);}
 },{passive:false});
 function finish(event:PointerEvent){
  if(!pointers.has(event.pointerId))return;
  if(scroll.hasPointerCapture(event.pointerId))scroll.releasePointerCapture(event.pointerId);
  if(mode==='pinch'||mode==='trim'||(mode==='pan'&&Math.hypot(event.clientX-startX,event.clientY-startY)>8))suppressUntil=performance.now()+350;
  pointers.delete(event.pointerId);
  if(mode==='trim'&&drag){const range=drag;drag=null;if(event.type==='pointercancel'){range.node.style.left=`${range.left}px`;range.node.style.width=`${range.width}px`;}else if(range.nextIn!==range.inFrame||range.nextOut!==range.outFrame){hooks.commitTrim(range.id,range.nextIn,range.nextOut);}}
  if(!pointers.size)mode='';else{mode='pan';startX=Array.from(pointers.values())[0].x;startY=Array.from(pointers.values())[0].y;startScrollTop=scroll.scrollTop;startScroll=scroll.scrollLeft;}
 }
 scroll.addEventListener('pointerup',finish);scroll.addEventListener('pointercancel',finish);
 return { closeSheet, showSheet };
}
