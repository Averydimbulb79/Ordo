import { protectTouchRange } from './touch-range';
import { setTransitions, setAdjustments } from './bulk';
import { clone, placements, trackOf } from './model';
import type { Project, Clip } from './model';
import { ADJUSTMENTS, TRANSITIONS, FONT_NAMES, newText, importCaptions, captionsToSrt } from './creative-model';
import type { TextItem, Transition } from './creative-model';
import { CROP_RATIOS, cropPreset, validateCrop } from './crop';
import type { Crop } from './crop';
import { download } from './media';
import type { LocalMedia } from './media';
import { ALL_FORMATS, BlobSource, Input, CanvasSink } from 'mediabunny';

type Hooks={project:()=>Project;selected:()=>Clip|undefined;frame:()=>number;busy:()=>boolean;commit:(p:Project)=>void;draft:(p:Project,live?:boolean)=>void;restore:(live?:boolean)=>void;media:(id:string)=>LocalMedia|undefined;beforeOpen:(live?:boolean)=>void};
export function setupCreative(hooks:Hooks){
 const sourceName=(p:Project,c:Clip)=>p.assets.find(a=>a.id===c.assetId)?.name??'Clip';
 function shell(title:string,live=false){
  hooks.beforeOpen(live);const dialog=document.createElement('dialog');dialog.className='creative-dialog';dialog.setAttribute('aria-label',title);
  dialog.innerHTML='<div class="dialog-head"><h2></h2><button class="creative-close" aria-label="Close panel">×</button></div><div class="creative-body"></div><p class="creative-error" role="alert"></p><div class="dialog-actions"><button class="creative-cancel">Cancel</button><button class="creative-apply accent">Apply</button></div>';
  dialog.querySelector('h2')!.textContent=title;document.body.append(dialog);
  const $=<T extends HTMLElement=HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
  dialog.addEventListener('keydown',event=>{if(live&&event.key==='Escape'){event.preventDefault();dialog.close();}});
  $('.creative-close').onclick=$('.creative-cancel').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{hooks.restore(live);dialog.remove();document.body.classList.remove('adjusting');for(const element of locked)element.inert=false;});
  const locked:HTMLElement[]=[];
  if(live){
   dialog.classList.add('adjust-panel');document.querySelector('.workspace')!.append(dialog);document.body.classList.add('adjusting');
   for(const element of document.querySelectorAll<HTMLElement>('.topbar,.toolbar,#mobile-dock,.statusbar,.workspace > :not(.monitor):not(.adjust-panel)'))if(!element.inert){element.inert=true;locked.push(element);}
  }
  const fail=(error:unknown)=>{$('.creative-error').textContent=error instanceof Error?error.message:String(error);};
  const preview=(read:()=>Project)=>{try{$('.creative-error').textContent='';hooks.draft(read(),live);}catch(error){fail(error);}};
  const apply=(read:()=>Project)=>{$('.creative-apply').onclick=()=>{try{hooks.commit(read());dialog.close();}catch(error){fail(error);}};};
  return{dialog,$,body:$('.creative-body'),fail,preview,apply,open:()=>live?dialog.show():dialog.showModal()};
 }
 function transitions(){
  const base=hooks.project(),main=base.clips.filter(c=>trackOf(c)==='v1'),panel=shell('Transitions');
  panel.body.innerHTML='<label>Between clips<select id="transition-join"></select></label><div class="transition-grid"></div><label>Duration (seconds)<input id="transition-duration" type="number" min="0.1" max="2" step="0.1" value="0.5"></label><label class="bulk-option"><input id="transition-all" type="checkbox"> Apply to all joins</label><p class="note">Transitions overlap adjacent V1 clips and crossfade their sound. Short clips use a shorter overlap.</p>';
  const join=panel.$<HTMLSelectElement>('#transition-join'),length=panel.$<HTMLInputElement>('#transition-duration');
  for(let i=0;i<main.length-1;i++){const option=document.createElement('option');option.value=main[i].id;option.textContent=`${i+1}. ${sourceName(base,main[i])} → ${sourceName(base,main[i+1])}`;join.append(option);}
  if(main.slice(0,-1).some(c=>c.id===hooks.selected()?.id))join.value=hooks.selected()!.id;
  let chosen:Transition|'cut'='cut';
  const all=panel.$<HTMLInputElement>('#transition-all');
  const read=()=>{
   if(main.length<2)throw new Error('Add two clips to V1 to create a transition.');
   const seconds=Number(length.value);if(!Number.isFinite(seconds)||seconds<.1||seconds>2)throw new Error('Choose a duration between 0.1 and 2 seconds.');
   return setTransitions(base,all.checked?main.slice(0,-1).map(c=>c.id):[join.value],chosen,Math.round(seconds*30));
  };
  all.onchange=()=>{join.disabled=all.checked;panel.$('.creative-apply').textContent=all.checked?'Apply to all joins':'Apply';panel.preview(read);};
  const update=()=>{for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-transition]'))button.setAttribute('aria-pressed',String(button.dataset.transition===chosen));};
  for(const [id,label] of [['cut','Cut · None'],...TRANSITIONS]){
   const button=document.createElement('button');button.type='button';button.dataset.transition=id;button.className='transition-choice';
   const swatch=document.createElement('span');swatch.className=`transition-swatch ${id}`;const text=document.createElement('span');text.textContent=label;button.append(swatch,text);button.onclick=()=>{chosen=id as Transition|'cut';update();panel.preview(read);};panel.$('.transition-grid').append(button);
  }
  const load=()=>{const c=base.clips.find(c=>c.id===join.value);chosen=c?.transitionFrames?(c.transition??'dissolve'):'cut';length.value=String((c?.transitionFrames||15)/30);update();};
  join.onchange=()=>{load();panel.preview(read);};length.oninput=()=>panel.preview(read);load();panel.apply(read);
  if(main.length<2){panel.fail(new Error('Add two clips to V1, then choose the join to edit.'));panel.$<HTMLButtonElement>('.creative-apply').disabled=true;}panel.open();
 }
 function adjust(){
  const base=hooks.project(),clip=hooks.selected(),panel=shell('Adjust',true);
  if(!clip||base.assets.find(a=>a.id===clip.assetId)?.kind!=='video'||trackOf(clip).startsWith('a')){panel.body.textContent='Select a video clip on V1 or V2 to adjust its picture.';panel.$<HTMLButtonElement>('.creative-apply').disabled=true;panel.open();return;}
  const caption=document.createElement('p');caption.className='note';caption.textContent=sourceName(base,clip)+' · Drag sideways to adjust; swipe vertically to scroll.';panel.body.append(caption);
  for(const [key,name,min,max,neutral] of ADJUSTMENTS){const label=document.createElement('label');label.className='adjust-row';label.htmlFor=`adjust-${key}`;label.textContent=name;const value=document.createElement('output');value.id=`value-${key}`;const input=document.createElement('input');input.id=`adjust-${key}`;input.type='range';input.min=String(min);input.max=String(max);input.step=key==='exposure'?'.05':'1';input.value=String(clip.adjustments?.[key]??neutral);value.textContent=input.value;protectTouchRange(input);input.oninput=()=>{value.textContent=input.value;panel.preview(read);};label.append(value,input);panel.body.append(label);}
  const scope=document.createElement('label');scope.className='bulk-option';scope.innerHTML='<input id="adjust-all" type="checkbox"> Apply to all video clips';panel.body.prepend(scope);
  const note=document.createElement('p');note.className='note';note.textContent='When checked, replaces existing adjustments on V1 and V2. Crop and placement stay as set.';scope.after(note);
  const all=panel.$<HTMLInputElement>('#adjust-all');
  const read=()=>{const values:NonNullable<Clip['adjustments']>={};for(const [key] of ADJUSTMENTS)values[key]=Number(panel.$<HTMLInputElement>(`#adjust-${key}`).value);return setAdjustments(base,all.checked?base.clips.map(c=>c.id):[clip.id],values);};
  all.onchange=()=>{panel.$('.creative-apply').textContent=all.checked?'Apply to all clips':'Apply';panel.preview(read);};
  const reset=document.createElement('button');reset.textContent='Reset adjustments';reset.id='reset-adjustments';reset.onclick=()=>{for(const [key,,,,value] of ADJUSTMENTS){panel.$<HTMLInputElement>(`#adjust-${key}`).value=String(value);panel.$(`#value-${key}`).textContent=String(value);}panel.preview(read);};panel.body.append(reset);panel.apply(read);panel.open();
 }
 function text(kind:TextItem['kind'],id?:string){
  const base=hooks.project(),items=(base.texts??[]).filter(t=>t.kind===kind),panel=shell(kind==='title'?'Title':'Captions');
  let item=items.find(t=>t.id===id)??newText(kind,hooks.frame());
  panel.body.innerHTML=`<label>${kind==='title'?'Title':'Caption'}<select id="text-item"><option value="new">Add new ${kind}</option></select></label><label>Text<textarea id="text-content" rows="3" maxlength="5000"></textarea></label><div class="form-grid"><label>Start (seconds)<input id="text-start" type="number" min="0" step="0.033333"></label><label>Duration (seconds)<input id="text-duration" type="number" min="0.033333" step="0.033333"></label></div><label>Google Font<select id="text-font"></select></label><p class="font-note">10 bundled Google Fonts · available offline</p><div class="text-style-tools"><button type="button" data-style="bold" aria-label="Bold"><b>B</b></button><button type="button" data-style="italic" aria-label="Italic"><i>I</i></button><button type="button" data-style="underline" aria-label="Underline"><u>U</u></button><button type="button" data-style="strike" aria-label="Strikethrough"><s>S</s></button></div><div class="form-grid"><label>Font size<input id="text-size" type="number" min="12" max="240"></label><label>Colour<input id="text-color" type="color"></label><label>Rotation (degrees)<input id="text-rotation" type="number" min="-180" max="180"></label><label>Alignment<select id="text-align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label><label>Horizontal position (%)<input id="text-x" type="number" min="0" max="100"></label><label>Vertical position (%)<input id="text-y" type="number" min="0" max="100"></label></div><div class="check-row"><label><input id="text-background" type="checkbox"> Background</label><label><input id="text-outline" type="checkbox"> Outline</label></div><button id="delete-text" class="danger">Delete ${kind}</button>`;
  const pick=panel.$<HTMLSelectElement>('#text-item');
  for(const t of items){const option=document.createElement('option');option.value=t.id;option.textContent=`${(t.startFrame/30).toFixed(2)} s · ${t.text.slice(0,60)}`;pick.append(option);}
  for(const family of FONT_NAMES){const option=document.createElement('option');option.value=family;option.textContent=family;panel.$('#text-font').append(option);}
  const fill=()=>{
   pick.value=items.some(t=>t.id===item.id)?item.id:'new';
   const values:Record<string,string>={content:item.text,start:String(item.startFrame/30),duration:String(item.frames/30),font:item.fontFamily,size:String(item.fontSize),color:item.color,rotation:String(item.rotation),align:item.align,x:String(item.x*100),y:String(item.y*100)};
   for(const [key,value] of Object.entries(values))panel.$<HTMLInputElement>(`#text-${key}`).value=value;
   for(const key of ['background','outline'] as const)panel.$<HTMLInputElement>(`#text-${key}`).checked=item[key];
   for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-style]'))button.setAttribute('aria-pressed',String(item[button.dataset.style as 'bold']));
   panel.$<HTMLButtonElement>('#delete-text').disabled=pick.value==='new';
  };
  const read=()=>{
   const p=clone(base),value=(key:string)=>panel.$<HTMLInputElement>(`#text-${key}`).value,number=(key:string)=>Number(value(key));
   const updated:TextItem={...item,text:value('content'),startFrame:Math.round(number('start')*30),frames:Math.round(number('duration')*30),fontFamily:value('font'),fontSize:number('size'),color:value('color'),rotation:number('rotation'),align:value('align') as TextItem['align'],x:number('x')/100,y:number('y')/100,background:panel.$<HTMLInputElement>('#text-background').checked,outline:panel.$<HTMLInputElement>('#text-outline').checked};
   for(const key of ['bold','italic','underline','strike'] as const)updated[key]=panel.$(`[data-style="${key}"]`).getAttribute('aria-pressed')==='true';
   if(!Number.isFinite(updated.frames)||updated.frames<1||!Number.isFinite(updated.startFrame)||updated.startFrame<0)throw new Error('Set a valid start and duration.');
   p.texts=[...(p.texts??[]).filter(t=>t.id!==item.id),updated];return p;
  };
  pick.onchange=()=>{item=items.find(t=>t.id===pick.value)??newText(kind,hooks.frame());fill();panel.preview(read);};
  panel.body.addEventListener('input',e=>{if((e.target as HTMLElement).id!=='text-item')panel.preview(read);});
  for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-style]'))button.onclick=()=>{button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));panel.preview(read);};
  panel.$('#delete-text').onclick=()=>{try{const p=clone(base);p.texts=(p.texts??[]).filter(t=>t.id!==item.id);hooks.commit(p);panel.dialog.close();}catch(error){panel.fail(error);}};
  if(kind==='caption'){
   const tools=document.createElement('div');tools.className='caption-file-tools';tools.innerHTML='<button id="import-captions">Import SRT / VTT</button><button id="export-captions">Export SRT</button><input id="caption-file" type="file" accept=".srt,.vtt,text/plain,text/vtt" hidden>';panel.body.prepend(tools);
   panel.$('#import-captions').onclick=()=>panel.$<HTMLInputElement>('#caption-file').click();
   panel.$<HTMLInputElement>('#caption-file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('Choose a caption file smaller than 1 MB.');const p=clone(base);p.texts=[...(p.texts??[]),...importCaptions(await file.text())];hooks.commit(p);panel.dialog.close();}catch(error){panel.fail(error);}};
   const exportButton=panel.$<HTMLButtonElement>('#export-captions');exportButton.disabled=!items.length;exportButton.onclick=async()=>{exportButton.disabled=true;try{await download(new Blob([captionsToSrt(items)],{type:'text/plain'}),'Ordo-captions.srt');}catch(error){panel.fail(error);}finally{exportButton.disabled=false;}};
  }
  fill();panel.apply(()=>{const p=read();if(!p.texts!.at(-1)!.text.trim())throw new Error('Enter some text first.');return p;});panel.open();panel.preview(read);
 }
 function crop(){
  const base=hooks.project(),clip=hooks.selected(),asset=base.assets.find(a=>a.id===clip?.assetId),panel=shell('Crop');
  if(!clip||!asset||asset.kind!=='video'||trackOf(clip).startsWith('a')){panel.body.textContent='Select a video clip on V1 or V2 to crop.';panel.$<HTMLButtonElement>('.creative-apply').disabled=true;panel.open();return;}
  let box:Crop=clip.crop??{x:0,y:0,width:1,height:1},picture:HTMLCanvasElement|null=null;
  panel.body.innerHTML='<label>Aspect ratio<select id="crop-ratio"></select></label><canvas id="crop-canvas" aria-label="Crop picture: drag the box or its corners"></canvas><p class="note">Drag a corner to resize. Drag inside the box to move it. Free size unlocks the aspect ratio.</p><div class="form-grid"></div><label class="check-row"><input id="crop-match" type="checkbox"> Match project canvas to cropped picture</label><button id="crop-reset">Reset crop</button>';
  for(const [id,name] of CROP_RATIOS){const option=document.createElement('option');option.value=id;option.textContent=name;panel.$('#crop-ratio').append(option);}panel.$<HTMLSelectElement>('#crop-ratio').value=clip.crop?'free':'original';
  const canvas=panel.$<HTMLCanvasElement>('#crop-canvas'),ctx=canvas.getContext('2d')!;
  for(const key of ['x','y','width','height'] as const){const label=document.createElement('label');label.textContent=`${key[0].toUpperCase()+key.slice(1)} (%)`;const input=document.createElement('input');input.type='number';input.id=`crop-${key}`;input.min='0';input.max='100';input.step='.1';label.append(input);panel.$('.form-grid').append(label);input.onchange=()=>{try{const next=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(panel.$<HTMLInputElement>('#crop-'+k).value)/100]));box=validateCrop(next);panel.$<HTMLSelectElement>('#crop-ratio').value='free';update();}catch(error){panel.fail(error);}};}
  const read=()=>{const p=clone(base),c=p.clips.find(c=>c.id===clip.id)!;const chosen=validateCrop(Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(panel.$<HTMLInputElement>('#crop-'+k).value)/100])));c.crop=chosen;if(panel.$<HTMLInputElement>('#crop-match').checked){const ratio=asset.width*chosen.width/(asset.height*chosen.height);p.width=Math.max(64,Math.round((ratio>=1?1280:1280*ratio)/2)*2);p.height=Math.max(64,Math.round((ratio>=1?1280/ratio:1280)/2)*2);}return p;};
  const draw=()=>{if(!picture)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(picture,0,0);const {x,y,width:w,height:h}=box;ctx.fillStyle='#0009';ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);ctx.rect(x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);ctx.fill('evenodd');ctx.strokeStyle='#a5f0d8';ctx.lineWidth=2;ctx.strokeRect(x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);for(const px of [x,x+w])for(const py of [y,y+h]){ctx.fillStyle='#a5f0d8';ctx.fillRect(px*canvas.width-5,py*canvas.height-5,10,10);}};
  const update=()=>{for(const key of ['x','y','width','height'] as const)panel.$<HTMLInputElement>(`#crop-${key}`).value=String(Math.round(box[key]*1000)/10);draw();panel.preview(read);};
  panel.$('#crop-ratio').onchange=()=>{const value=panel.$<HTMLSelectElement>('#crop-ratio').value;if(value!=='free')box=cropPreset(value,asset.width,asset.height);update();};
  panel.$('#crop-match').onchange=()=>panel.preview(read);panel.$('#crop-reset').onclick=()=>{box={x:0,y:0,width:1,height:1};panel.$<HTMLSelectElement>('#crop-ratio').value='original';update();};
  let drag:{mode:string;x:number;y:number;box:Crop}|null=null;
  const point=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
  canvas.onpointerdown=e=>{const p=point(e),r=canvas.getBoundingClientRect();let mode='move';for(const [name,x,y] of [['tl',box.x,box.y],['tr',box.x+box.width,box.y],['bl',box.x,box.y+box.height],['br',box.x+box.width,box.y+box.height]] as const)if(Math.hypot((p.x-x)*r.width,(p.y-y)*r.height)<24)mode=name;drag={mode,...p,box:{...box}};canvas.setPointerCapture(e.pointerId);e.preventDefault();};
  canvas.onpointermove=e=>{if(!drag)return;const p=point(e),old=drag.box;
   if(drag.mode==='move'){box={...old,x:Math.max(0,Math.min(1-old.width,old.x+p.x-drag.x)),y:Math.max(0,Math.min(1-old.height,old.y+p.y-drag.y))};}
   else{const right=drag.mode.endsWith('r'),bottom=drag.mode.startsWith('b'),ax=right?old.x:old.x+old.width,ay=bottom?old.y:old.y+old.height;let w=Math.max(.02,Math.abs(p.x-ax)),h=Math.max(.02,Math.abs(p.y-ay));const ratio=panel.$<HTMLSelectElement>('#crop-ratio').value;
    if(ratio!=='free'){const target=ratio==='original'?asset.width/asset.height:ratio.split(':').map(Number).reduce((a,b)=>a/b);const factor=asset.width/asset.height/target;w=Math.min(w,right?1-ax:ax,(bottom?1-ay:ay)/factor);h=w*factor;}else{w=Math.min(w,right?1-ax:ax);h=Math.min(h,bottom?1-ay:ay);}
    box={x:right?ax:ax-w,y:bottom?ay:ay-h,width:Math.max(.02,w),height:Math.max(.02,h)};
   }update();};
  canvas.onpointerup=canvas.onpointercancel=e=>{drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
  panel.apply(read);panel.open();update();
  void(async()=>{const local=hooks.media(clip.assetId);if(!local){panel.fail(new Error('Relink this clip before choosing a crop.'));return;}const input=new Input({source:new BlobSource(local.file),formats:ALL_FORMATS});try{const track=await input.getPrimaryVideoTrack();if(!track)return;const factor=Math.min(600/asset.width,350/asset.height);canvas.width=Math.max(1,Math.round(asset.width*factor));canvas.height=Math.max(1,Math.round(asset.height*factor));const sink=new CanvasSink(track,{width:canvas.width,height:canvas.height,fit:'contain',poolSize:1});const entry=placements(base).find(e=>e.clip.id===clip.id)!,sample=await sink.getCanvas((clip.inFrame+Math.max(0,Math.min(clip.frames-1,hooks.frame()-entry.start)))/30);if(!sample)return;picture=document.createElement('canvas');picture.width=canvas.width;picture.height=canvas.height;picture.getContext('2d')!.drawImage(sample.canvas,0,0);canvas.dataset.ready='true';draw();}catch(error){panel.fail(error);}finally{input.dispose();}})();
 }
 return{open:(kind:string,id?:string)=>{if(hooks.busy())return;if(kind==='transitions')transitions();else if(kind==='adjust')adjust();else if(kind==='crop')crop();else text(kind==='captions'?'caption':'title',id);}};
}
