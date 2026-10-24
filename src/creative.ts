import { AUDIO_CONTROLS, audioTrack, crossfadeAudio, edgeFades, copyAudio } from './audio-model';
import type { AudioSettings } from './audio-model';
import { loadFont } from './fonts';
import { attachTextTransform } from './text-transform';
import { protectTouchRange } from './touch-range';
import { setTransitions, setEdgeTransitions, setAdjustments } from './bulk';
import { clone, placements, trackOf, sourceAt } from './model';
import type { Project, Clip } from './model';
import { ADJUSTMENTS, TRANSITIONS, FONT_NAMES, newText, importCaptions, captionsToSrt, parseTexts } from './creative-model';
import type { TextItem, Transition } from './creative-model';
import { CROP_RATIOS, cropPreset, validateCrop } from './crop';
import type { Crop } from './crop';
import { download, decodeImage } from './media';
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
 function isAudio(){const c=hooks.selected();return !!c&&(trackOf(c).startsWith('a')||hooks.project().assets.find(a=>a.id===c.assetId)?.kind==='audio');}
 function audioAdjust(){
  const base=hooks.project(),clip=hooks.selected()!,panel=shell('Adjust audio',true);
  const hint=document.createElement('p');hint.className='note';hint.textContent=sourceName(base,clip)+' · Drag sideways to adjust; swipe vertically to scroll.';panel.body.append(hint);
  const check=(key:string,label:string)=>{const row=document.createElement('label');row.className='bulk-option';const input=document.createElement('input');input.type='checkbox';input.id='audio-'+key;row.append(input,document.createTextNode(label));panel.body.append(row);};
  const controls=[['volume','Volume (%)',0,100,100,1],...AUDIO_CONTROLS] as const;
  for(const [key,name,min,max,neutral,step] of controls){
   if(key==='threshold')check('compressor','Compressor');if(key==='fadeIn')check('limiter','Limiter');
   const label=document.createElement('label');label.className='adjust-row';label.htmlFor='audio-'+key;label.textContent=name;
   const output=document.createElement('output');output.id='audio-value-'+key;
   const input=document.createElement('input');input.type='range';input.id='audio-'+key;input.min=String(min);input.max=String((key==='fadeIn'||key==='fadeOut')?Math.min(max,clip.frames/30):max);input.step=String(step);input.value=String(key==='volume'?clip.volume*100:clip.audio?.[key]??neutral);output.textContent=input.value;
   protectTouchRange(input);input.oninput=()=>{output.textContent=input.value;panel.preview(read);};label.append(output,input);panel.body.append(label);
  }
  const scopeKind=base.assets.find(a=>a.id===clip.assetId)?.kind==='video'?'video':'audio';
  check('all',`Apply to all ${scopeKind} clips`);const note=document.createElement('p');note.className='note';note.textContent='Apply to all replaces audio settings and volume. Adjusted bypasses processing; volume and fades remain active.';panel.body.append(note);
  for(const key of ['compressor','limiter'] as const)panel.$<HTMLInputElement>('#audio-'+key).checked=clip.audio?.[key]??false;
  const read=()=>{const settings:AudioSettings={};for(const [key] of AUDIO_CONTROLS)settings[key]=Number(panel.$<HTMLInputElement>('#audio-'+key).value);for(const key of ['compressor','limiter'] as const)settings[key]=panel.$<HTMLInputElement>('#audio-'+key).checked;
   const all=panel.$<HTMLInputElement>('#audio-all').checked,ids=all?base.clips.filter(c=>base.assets.find(a=>a.id===c.assetId)?.kind===scopeKind).map(c=>c.id):[clip.id];
   const p=copyAudio(base,ids,settings),volume=Number(panel.$<HTMLInputElement>('#audio-volume').value)/100;for(const c of p.clips)if(ids.includes(c.id))c.volume=volume;return p;
  };
  for(const key of ['all','compressor','limiter'])panel.$<HTMLInputElement>('#audio-'+key).onchange=()=>{panel.$('.creative-apply').textContent=panel.$<HTMLInputElement>('#audio-all').checked?'Apply to all clips':'Apply';panel.preview(read);};
  const reset=document.createElement('button');reset.id='reset-audio';reset.textContent='Reset audio adjustments';reset.onclick=()=>{for(const [key,,,,neutral] of controls){panel.$<HTMLInputElement>('#audio-'+key).value=String(neutral);panel.$('#audio-value-'+key).textContent=String(neutral);}for(const key of ['compressor','limiter'])panel.$<HTMLInputElement>('#audio-'+key).checked=false;panel.preview(read);};panel.body.append(reset);panel.apply(read);panel.open();
 }
 function audioTransitions(){
  const base=hooks.project(),panel=shell('Audio transitions');
  panel.body.innerHTML='<label>Audio track<select id="audio-transition-track"><option value="a1">A1</option><option value="a2">A2</option></select></label><label>Between clips<select id="audio-transition-join"></select></label><label class="bulk-option"><input id="audio-crossfade-enabled" type="checkbox"> Crossfade</label><label>Crossfade duration (seconds)<input id="audio-crossfade-duration" type="number" min="0.1" max="10" step="0.1" value="0.5"></label><label class="bulk-option"><input id="audio-crossfade-all" type="checkbox"> Apply to all adjacent joins</label><label>Fade in first audio clip (seconds)<input id="audio-first-fade" type="number" min="0" max="120" step="0.1" value="0"></label><label>Fade out last audio clip (seconds)<input id="audio-last-fade" type="number" min="0" max="120" step="0.1" value="0"></label><p class="note">Crossfades overlap touching clips on this audio track, shortening its assembly. Gaps are kept. Video timing stays as set. Short clips use a shorter overlap. Fades apply to the first and last clip on the chosen track. Zero removes a fade.</p>';
  const crossfadeGroup=document.createElement('div');while(panel.body.firstChild)crossfadeGroup.append(panel.body.firstChild);panel.body.append(crossfadeGroup);
  const modeLabel=document.createElement('label');modeLabel.innerHTML='Transition<select id="audio-transition-type"><option value="fadeIn">Fade in</option><option value="fadeOut">Fade out</option><option value="crossfade" selected>Crossfade</option></select>';panel.body.prepend(modeLabel);
  const fadeGroup=document.createElement('div');fadeGroup.hidden=true;fadeGroup.innerHTML='<label>Audio clip<select id="audio-fade-clip"></select></label><label>Duration (seconds)<input id="audio-fade-duration" type="number" min="0" max="120" step="0.1" value="0.5"></label><label class="bulk-option"><input id="audio-fade-all" type="checkbox"> Apply to all audio clips</label><p class="note">Zero removes the fade. Short clips clamp the fade to their duration. Video timing stays as set.</p>';panel.body.append(fadeGroup);
  const mode=panel.$<HTMLSelectElement>('#audio-transition-type'),fadeClip=panel.$<HTMLSelectElement>('#audio-fade-clip'),fadeLength=panel.$<HTMLInputElement>('#audio-fade-duration'),fadeAll=panel.$<HTMLInputElement>('#audio-fade-all');
  const candidates=base.clips.filter(c=>trackOf(c).startsWith('a')||base.assets.find(a=>a.id===c.assetId)?.kind==='audio');
  for(const c of candidates){const option=document.createElement('option');option.value=c.id;option.textContent=trackOf(c).toUpperCase()+' · '+sourceName(base,c);fadeClip.append(option);}if(candidates.some(c=>c.id===hooks.selected()?.id))fadeClip.value=hooks.selected()!.id;
  const loadFade=()=>{const c=candidates.find(c=>c.id===fadeClip.value);fadeLength.value=String(c?.audio?.[mode.value as 'fadeIn'|'fadeOut']??.5);};
  mode.onchange=()=>{hooks.restore();const fade=mode.value!=='crossfade';crossfadeGroup.hidden=fade;fadeGroup.hidden=!fade;loadFade();panel.$<HTMLButtonElement>('.creative-apply').disabled=fade?!candidates.length:!audioTrack(base,track.value as 'a1'|'a2').length;};fadeClip.onchange=()=>{loadFade();panel.preview(read);};fadeAll.onchange=()=>{fadeClip.disabled=fadeAll.checked;panel.preview(read);};
  const track=panel.$<HTMLSelectElement>('#audio-transition-track'),join=panel.$<HTMLSelectElement>('#audio-transition-join'),enabled=panel.$<HTMLInputElement>('#audio-crossfade-enabled');
  if(trackOf(hooks.selected()!).startsWith('a'))track.value=trackOf(hooks.selected()!);
  const loadJoin=()=>{const c=base.clips.find(c=>c.id===join.value);enabled.checked=!!c?.audioCrossfadeFrames;panel.$<HTMLInputElement>('#audio-crossfade-duration').value=String((c?.audioCrossfadeFrames||15)/30);};
  const load=()=>{const lane=audioTrack(base,track.value as 'a1'|'a2');join.replaceChildren();for(let i=0;i<lane.length-1;i++){const option=document.createElement('option');option.value=lane[i].id;option.textContent=sourceName(base,lane[i])+' → '+sourceName(base,lane[i+1]);join.append(option);}if(lane.slice(0,-1).some(c=>c.id===hooks.selected()?.id))join.value=hooks.selected()!.id;loadJoin();for(const id of ['audio-crossfade-enabled','audio-crossfade-duration','audio-crossfade-all'])panel.$<HTMLInputElement>('#'+id).disabled=lane.length<2;join.disabled=lane.length<2||panel.$<HTMLInputElement>('#audio-crossfade-all').checked;panel.$<HTMLInputElement>('#audio-first-fade').value=String(lane[0]?.audio?.fadeIn??0);panel.$<HTMLInputElement>('#audio-last-fade').value=String(lane.at(-1)?.audio?.fadeOut??0);panel.$<HTMLButtonElement>('.creative-apply').disabled=!lane.length;};
  const read=()=>{const number=(id:string,min:number,max:number)=>{const n=Number(panel.$<HTMLInputElement>(id).value);if(!Number.isFinite(n)||n<min||n>max)throw new Error('Choose a fade duration within the displayed range.');return n;};
   if(mode.value!=='crossfade'){
    const seconds=number('#audio-fade-duration',0,120),p=clone(base),ids=fadeAll.checked?candidates.map(c=>c.id):[fadeClip.value];
    for(const c of p.clips)if(ids.includes(c.id))c.audio={...c.audio,[mode.value]:Math.min(seconds,c.frames/30)};return p;
   }
   const lane=audioTrack(base,track.value as 'a1'|'a2'),ids=panel.$<HTMLInputElement>('#audio-crossfade-all').checked?lane.slice(0,-1).map(c=>c.id):[join.value];
   const p=crossfadeAudio(base,track.value as 'a1'|'a2',ids,enabled.checked?Math.round(number('#audio-crossfade-duration',.1,10)*30):0);
   return edgeFades(p,track.value as 'a1'|'a2',number('#audio-first-fade',0,120),number('#audio-last-fade',0,120));
  };
  panel.$<HTMLInputElement>('#audio-crossfade-all').onchange=()=>{join.disabled=panel.$<HTMLInputElement>('#audio-crossfade-all').checked;};
  track.onchange=()=>{load();panel.preview(read);};join.onchange=()=>{loadJoin();panel.preview(read);};
  panel.body.addEventListener('input',event=>{if((event.target as HTMLElement).id!=='audio-transition-track'&&(event.target as HTMLElement).id!=='audio-transition-join')panel.preview(read);});
  load();panel.apply(read);panel.open();
 }
 function transitions(){
  if(isAudio())return audioTransitions();
  const base=hooks.project(),pictures=base.clips.filter(c=>!trackOf(c).startsWith('a')&&base.assets.find(a=>a.id===c.assetId)?.kind!=='audio'),main=pictures.filter(c=>trackOf(c)==='v1'),panel=shell('Transitions');
  panel.body.innerHTML='<label>Category<select id="transition-category"><option value="start">Start</option><option value="end">End</option><option value="between" selected>Between</option></select></label><label id="transition-target-label">Between clips<select id="transition-join"></select></label><div class="transition-grid"></div><label>Duration (seconds)<input id="transition-duration" type="number" min="0.1" max="2" step="0.1" value="0.5"></label><label class="bulk-option"><input id="transition-all" type="checkbox"> <span id="transition-all-label">Apply to all joins</span></label><p class="note" id="transition-note"></p>';
  const category=panel.$<HTMLSelectElement>('#transition-category'),join=panel.$<HTMLSelectElement>('#transition-join'),length=panel.$<HTMLInputElement>('#transition-duration'),all=panel.$<HTMLInputElement>('#transition-all');
  let chosen:Transition|'cut'='cut';
  const targets=()=>category.value==='between'?main.slice(0,-1):pictures;
  const read=()=>{
   if(!targets().length)throw new Error(category.value==='between'?'Add two picture clips to V1 to create a Between transition.':'Add a picture clip on V1 or V2 first.');
   const seconds=Number(length.value),max=category.value==='between'?2:10;if(!Number.isFinite(seconds)||seconds<.1||seconds>max)throw new Error(`Choose a duration between 0.1 and ${max} seconds.`);
   const ids=all.checked?targets().map(c=>c.id):[join.value];
   return category.value==='between'?setTransitions(base,ids,chosen,Math.round(seconds*30)):setEdgeTransitions(base,ids,category.value as 'start'|'end',chosen,Math.round(seconds*30));
  };
  const update=()=>{for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-transition]'))button.setAttribute('aria-pressed',String(button.dataset.transition===chosen));};
  for(const [id,label] of [['cut','None'],...TRANSITIONS]){
   const button=document.createElement('button');button.type='button';button.dataset.transition=id;button.className='transition-choice';
   const swatch=document.createElement('span');swatch.className=`transition-swatch ${id}`;const text=document.createElement('span');text.textContent=label;button.append(swatch,text);button.onclick=()=>{chosen=id as Transition|'cut';update();panel.preview(read);};panel.$('.transition-grid').append(button);
  }
  const load=()=>{const c=base.clips.find(c=>c.id===join.value),edge=category.value==='start'?c?.startTransition:c?.endTransition;
   chosen=category.value==='between'?(c?.transitionFrames?(c.transition??'dissolve'):'cut'):(edge?.type??'cut');length.value=String((category.value==='between'?(c?.transitionFrames||15):(edge?.frames||15))/30);update();};
  const scope=()=>{join.disabled=all.checked||!targets().length;panel.$('#transition-all-label').textContent=category.value==='between'?'Apply to all joins':'Apply to all picture clips';panel.$('.creative-apply').textContent=all.checked?(category.value==='between'?'Apply to all joins':'Apply to all clips'):'Apply';};
  const loadCategory=()=>{
   join.replaceChildren();const between=category.value==='between';
   for(const c of targets()){const option=document.createElement('option');option.value=c.id;const i=main.findIndex(m=>m.id===c.id);option.textContent=between?`${i+1}. ${sourceName(base,c)} → ${sourceName(base,main[i+1])}`:`${trackOf(c).toUpperCase()} · ${sourceName(base,c)}`;join.append(option);}
   if(targets().some(c=>c.id===hooks.selected()?.id))join.value=hooks.selected()!.id;
   panel.$('#transition-target-label').firstChild!.textContent=between?'Between clips':'Clip';length.max=between?'2':'10';
   panel.$('#transition-note').textContent=between?'Between transitions overlap adjacent V1 picture clips and crossfade their sound. Short clips use a shorter overlap.':'Start and End animate a clip’s picture without moving it or changing its sound. Available on V1 and V2; short clips clamp the animation to their duration.';
   panel.$('.creative-error').textContent='';panel.$<HTMLButtonElement>('.creative-apply').disabled=!targets().length;if(!targets().length)panel.fail(new Error(between?'Add two picture clips to V1, or choose Start or End.':'Add a video or image clip to V1 or V2.'));scope();load();
  };
  all.onchange=()=>{scope();panel.preview(read);};category.onchange=()=>{hooks.restore();loadCategory();};join.onchange=()=>{load();panel.preview(read);};length.oninput=()=>panel.preview(read);
  if(main.length<2||trackOf(hooks.selected()??{id:'',assetId:'',inFrame:0,frames:1,volume:1})==='v2')category.value='start';
  loadCategory();panel.apply(read);panel.open();
 }
 function adjust(){
  if(isAudio())return audioAdjust();
  const base=hooks.project(),clip=hooks.selected(),panel=shell('Adjust',true);
  if(!clip||base.assets.find(a=>a.id===clip.assetId)?.kind==='audio'||trackOf(clip).startsWith('a')){panel.body.textContent='Select a video or image clip on V1 or V2 to adjust its picture.';panel.$<HTMLButtonElement>('.creative-apply').disabled=true;panel.open();return;}
  const caption=document.createElement('p');caption.className='note';caption.textContent=sourceName(base,clip)+' · Drag sideways to adjust; swipe vertically to scroll.';panel.body.append(caption);
  const alpha=document.createElement('label');alpha.className='adjust-row';alpha.innerHTML=`Opacity (%)<output id="value-opacity">${Math.round((clip.opacity??1)*100)}</output><input id="adjust-opacity" type="range" min="0" max="100" value="${Math.round((clip.opacity??1)*100)}">`;panel.body.append(alpha);protectTouchRange(panel.$<HTMLInputElement>('#adjust-opacity'));panel.$('#adjust-opacity').oninput=()=>{panel.$('#value-opacity').textContent=panel.$<HTMLInputElement>('#adjust-opacity').value;panel.preview(read);};
  for(const [key,name,min,max,neutral] of ADJUSTMENTS){const label=document.createElement('label');label.className='adjust-row';label.htmlFor=`adjust-${key}`;label.textContent=name;const value=document.createElement('output');value.id=`value-${key}`;const input=document.createElement('input');input.id=`adjust-${key}`;input.type='range';input.min=String(min);input.max=String(max);input.step=key==='exposure'?'.05':'1';input.value=String(clip.adjustments?.[key]??neutral);value.textContent=input.value;protectTouchRange(input);input.oninput=()=>{value.textContent=input.value;panel.preview(read);};label.append(value,input);panel.body.append(label);}
  const scope=document.createElement('label');scope.className='bulk-option';scope.innerHTML='<input id="adjust-all" type="checkbox"> Apply to all picture clips';panel.body.prepend(scope);
  const note=document.createElement('p');note.className='note';note.textContent='When checked, replaces picture opacity and colour adjustments on V1 and V2. Crop and placement stay as set.';scope.after(note);
  const all=panel.$<HTMLInputElement>('#adjust-all');
  const read=()=>{const values:NonNullable<Clip['adjustments']>={};for(const [key] of ADJUSTMENTS)values[key]=Number(panel.$<HTMLInputElement>(`#adjust-${key}`).value);const ids=all.checked?base.clips.filter(c=>!trackOf(c).startsWith('a')&&base.assets.find(a=>a.id===c.assetId)?.kind!=='audio').map(c=>c.id):[clip.id],p=setAdjustments(base,ids,values);for(const c of p.clips)if(ids.includes(c.id))c.opacity=Number(panel.$<HTMLInputElement>('#adjust-opacity').value)/100;return p;};
  all.onchange=()=>{panel.$('.creative-apply').textContent=all.checked?'Apply to all clips':'Apply';panel.preview(read);};
  const reset=document.createElement('button');reset.textContent='Reset adjustments';reset.id='reset-adjustments';reset.onclick=()=>{panel.$<HTMLInputElement>('#adjust-opacity').value='100';panel.$('#value-opacity').textContent='100';for(const [key,,,,value] of ADJUSTMENTS){panel.$<HTMLInputElement>(`#adjust-${key}`).value=String(value);panel.$(`#value-${key}`).textContent=String(value);}panel.preview(read);};panel.body.append(reset);panel.apply(read);panel.open();
 }
 function text(kind:TextItem['kind'],id?:string){
  const base=hooks.project(),items=(base.texts??[]).filter(t=>t.kind===kind),panel=shell(kind==='title'?'Title':'Captions',true);
  let item=items.find(t=>t.id===id)??newText(kind,hooks.frame());
  panel.body.innerHTML=`<label>${kind==='title'?'Title':'Caption'}<select id="text-item"><option value="new">Add new ${kind}</option></select></label><label>Text<textarea id="text-content" rows="3" maxlength="5000"></textarea></label><div class="form-grid"><label>Start (seconds)<input id="text-start" type="number" min="0" step="0.033333"></label><label>Duration (seconds)<input id="text-duration" type="number" min="0.033333" step="0.033333"></label></div><label>Google Font<select id="text-font"></select></label><p class="font-note">66 bundled Google Fonts · available offline</p><div class="text-style-tools"><button type="button" data-style="bold" aria-label="Bold"><b>B</b></button><button type="button" data-style="italic" aria-label="Italic"><i>I</i></button><button type="button" data-style="underline" aria-label="Underline"><u>U</u></button><button type="button" data-style="strike" aria-label="Strikethrough"><s>S</s></button></div><div class="form-grid"><label>Font size<input id="text-size" type="number" min="12" max="240"></label><label>Colour<input id="text-color" type="color"></label><label>Rotation (degrees)<input id="text-rotation" type="number" min="-180" max="180"></label><label>Alignment<select id="text-align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label><label>Horizontal position (%)<input id="text-x" type="number" min="0" max="100"></label><label>Vertical position (%)<input id="text-y" type="number" min="0" max="100"></label></div><div class="check-row"><label><input id="text-background" type="checkbox"> Background</label><label><input id="text-outline" type="checkbox"> Outline</label></div><button id="delete-text" class="danger">Delete ${kind}</button>`;
  const extra=document.createElement('div');extra.innerHTML='<p class="note">Drag the text in Program to move it. Drag the round handle to rotate. Apply saves the changes; Cancel restores them.</p><label class="adjust-row">Opacity (%)<output id="text-opacity-value"></output><input id="text-opacity" type="range" min="0" max="100" value="100"></label><div class="form-grid"><label>Start transition<select id="text-start-effect"></select></label><label>Duration (seconds)<input id="text-start-effect-duration" type="number" min="0.033333" max="10" step="0.1" value="0.5"></label><label>End transition<select id="text-end-effect"></select></label><label>Duration (seconds)<input id="text-end-effect-duration" type="number" min="0.033333" max="10" step="0.1" value="0.5"></label></div>';panel.body.insertBefore(extra,panel.$('#delete-text'));
  protectTouchRange(panel.$<HTMLInputElement>('#text-opacity'));
  for(const side of ['start','end']){const select=panel.$<HTMLSelectElement>('#text-'+side+'-effect');select.add(new Option('None','none'));for(const [value,label] of TRANSITIONS)select.add(new Option(label,value));}
  const pick=panel.$<HTMLSelectElement>('#text-item');
  for(const t of items){const option=document.createElement('option');option.value=t.id;option.textContent=`${(t.startFrame/30).toFixed(2)} s · ${t.text.slice(0,60)}`;pick.append(option);}
  for(const family of FONT_NAMES){const option=document.createElement('option');option.value=family;option.textContent=family;panel.$('#text-font').append(option);}
  const fill=()=>{
   pick.value=items.some(t=>t.id===item.id)?item.id:'new';
   const values:Record<string,string>={content:item.text,start:String(item.startFrame/30),duration:String(item.frames/30),font:item.fontFamily,size:String(item.fontSize),color:item.color,rotation:String(item.rotation),align:item.align,x:String(item.x*100),y:String(item.y*100)};
   for(const [key,value] of Object.entries(values))panel.$<HTMLInputElement>(`#text-${key}`).value=value;
   for(const key of ['background','outline'] as const)panel.$<HTMLInputElement>(`#text-${key}`).checked=item[key];
   panel.$<HTMLInputElement>('#text-opacity').value=String((item.opacity??1)*100);panel.$('#text-opacity-value').textContent=String(Math.round((item.opacity??1)*100));
   for(const side of ['start','end'] as const){const edge=item[side==='start'?'startTransition':'endTransition'];panel.$<HTMLSelectElement>('#text-'+side+'-effect').value=edge?.type??'none';panel.$<HTMLInputElement>('#text-'+side+'-effect-duration').value=String((edge?.frames??15)/30);}
   for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-style]'))button.setAttribute('aria-pressed',String(item[button.dataset.style as 'bold']));
   panel.$<HTMLButtonElement>('#delete-text').disabled=pick.value==='new';
  };
  const read=()=>{
   const p=clone(base),value=(key:string)=>panel.$<HTMLInputElement>(`#text-${key}`).value,number=(key:string)=>Number(value(key));
   const updated:TextItem={...item,text:value('content'),startFrame:Math.round(number('start')*30),frames:Math.round(number('duration')*30),fontFamily:value('font'),fontSize:number('size'),color:value('color'),rotation:number('rotation'),align:value('align') as TextItem['align'],x:number('x')/100,y:number('y')/100,background:panel.$<HTMLInputElement>('#text-background').checked,outline:panel.$<HTMLInputElement>('#text-outline').checked};
   updated.opacity=number('opacity')/100;
   for(const side of ['start','end'] as const){const type=value(side+'-effect'),key=side==='start'?'startTransition':'endTransition';if(type==='none')delete updated[key];else updated[key]={type:type as Transition,frames:Math.round(number(side+'-effect-duration')*30)};}
   for(const key of ['bold','italic','underline','strike'] as const)updated[key]=panel.$(`[data-style="${key}"]`).getAttribute('aria-pressed')==='true';
   if(!Number.isFinite(updated.frames)||updated.frames<1||!Number.isFinite(updated.startFrame)||updated.startFrame<0)throw new Error('Set a valid start and duration.');
   p.texts=[...(p.texts??[]).filter(t=>t.id!==item.id),parseTexts([updated],FONT_NAMES)[0]];return p;
  };
  let transforms:ReturnType<typeof attachTextTransform>|undefined;
  let previewItem=item,fontSignature='';
  const previewText=()=>{try{const p=read();previewItem=p.texts!.find(t=>t.id===item.id)!;panel.$('#text-opacity-value').textContent=panel.$<HTMLInputElement>('#text-opacity').value;panel.preview(()=>p);transforms?.update();const signature=JSON.stringify([previewItem.fontFamily,previewItem.bold,previewItem.italic]);if(signature!==fontSignature){fontSignature=signature;void loadFont(previewItem.fontFamily,previewItem.bold,previewItem.italic).then(()=>{if(panel.dialog.isConnected){panel.preview(read);transforms?.update();}}).catch(panel.fail);}}catch(error){panel.fail(error);}};
  pick.onchange=()=>{item=items.find(t=>t.id===pick.value)??newText(kind,hooks.frame());fill();previewText();};
  panel.body.addEventListener('input',e=>{if((e.target as HTMLElement).id!=='text-item')previewText();});
  for(const button of panel.dialog.querySelectorAll<HTMLButtonElement>('[data-style]'))button.onclick=()=>{button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));previewText();};
  panel.$('#delete-text').onclick=()=>{try{const p=clone(base);p.texts=(p.texts??[]).filter(t=>t.id!==item.id);hooks.commit(p);panel.dialog.close();}catch(error){panel.fail(error);}};
  if(kind==='caption'){
   const tools=document.createElement('div');tools.className='caption-file-tools';tools.innerHTML='<button id="import-captions">Import SRT / VTT</button><button id="export-captions">Export SRT</button><input id="caption-file" type="file" accept=".srt,.vtt,text/plain,text/vtt" hidden>';panel.body.prepend(tools);
   panel.$('#import-captions').onclick=()=>panel.$<HTMLInputElement>('#caption-file').click();
   panel.$<HTMLInputElement>('#caption-file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('Choose a caption file smaller than 1 MB.');const p=clone(base);p.texts=[...(p.texts??[]),...importCaptions(await file.text())];hooks.commit(p);panel.dialog.close();}catch(error){panel.fail(error);}};
   const exportButton=panel.$<HTMLButtonElement>('#export-captions');exportButton.disabled=!items.length;exportButton.onclick=async()=>{exportButton.disabled=true;try{await download(new Blob([captionsToSrt(items)],{type:'text/plain'}),'Ordo-captions.srt');}catch(error){panel.fail(error);}finally{exportButton.disabled=false;}};
  }
  fill();panel.apply(()=>{const p=read();if(!p.texts!.at(-1)!.text.trim())throw new Error('Enter some text first.');return p;});panel.open();panel.preview(read);
  transforms=attachTextTransform(document.querySelector<HTMLCanvasElement>('#preview')!,()=>previewItem,values=>{for(const [key,value] of Object.entries(values))panel.$<HTMLInputElement>('#text-'+(key==='fontSize'?'size':key)).value=String(key==='x'||key==='y'?Number(value)*100:value);previewText();});
  panel.dialog.addEventListener('close',()=>transforms?.dispose(),{once:true});previewText();
 }
 function crop(){
  const base=hooks.project(),clip=hooks.selected(),asset=base.assets.find(a=>a.id===clip?.assetId),panel=shell('Crop');
  if(!clip||!asset||asset.kind==='audio'||trackOf(clip).startsWith('a')){panel.body.textContent='Select a video or image clip on V1 or V2 to crop.';panel.$<HTMLButtonElement>('.creative-apply').disabled=true;panel.open();return;}
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
  void(async()=>{const local=hooks.media(clip.assetId);if(!local){panel.fail(new Error('Relink this clip before choosing a crop.'));return;}if(asset.kind==='image'){try{const image=await decodeImage(local.file);try{const factor=Math.min(600/image.width,350/image.height);canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));picture=document.createElement('canvas');picture.width=canvas.width;picture.height=canvas.height;picture.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);canvas.dataset.ready='true';draw();}finally{image.close();}}catch(error){panel.fail(error);}return;}const input=new Input({source:new BlobSource(local.file),formats:ALL_FORMATS});try{const track=await input.getPrimaryVideoTrack();if(!track)return;const factor=Math.min(600/asset.width,350/asset.height);canvas.width=Math.max(1,Math.round(asset.width*factor));canvas.height=Math.max(1,Math.round(asset.height*factor));const sink=new CanvasSink(track,{width:canvas.width,height:canvas.height,fit:'contain',poolSize:1});const entry=placements(base).find(e=>e.clip.id===clip.id)!,sample=await sink.getCanvas(sourceAt(clip,Math.max(0,Math.min(clip.frames-1,hooks.frame()-entry.start)))/30);if(!sample)return;picture=document.createElement('canvas');picture.width=canvas.width;picture.height=canvas.height;picture.getContext('2d')!.drawImage(sample.canvas,0,0);canvas.dataset.ready='true';draw();}catch(error){panel.fail(error);}finally{input.dispose();}})();
 }
 return{open:(kind:string,id?:string)=>{if(hooks.busy())return;if(kind==='audio'){if(hooks.selected())audioAdjust();}else if(kind==='transitions')transitions();else if(kind==='adjust')adjust();else if(kind==='crop')crop();else text(kind==='captions'?'caption':'title',id);}};
}
