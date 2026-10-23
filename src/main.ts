import { isAndroid, keepAwake, exitAndroid } from './native';
import { setupMobile } from './mobile';
import { openDB } from 'idb';
import { clone, duration, fresh, History, locate, parseProject, sourceFrames, split, timecode, trim } from './model';
import type { Asset, Project } from './model';
import { download, inspect } from './media';
import type { LocalMedia } from './media';
import { Preview } from './preview';
import { exportSequence, LIMIT_SECONDS, supported } from './export';
import type { Format } from './export';
import './style.css';

const icons: Record<string,string> = {
 import:'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5', open:'M3 7h7l2 3h9l-3 10H3V7Zm0 0V4h7l2 3h7v3', save:'M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7', undo:'M9 4 3 10l6 6M3 10h10a7 7 0 0 1 7 7', redo:'m15 4 6 6-6 6m6-6H11a7 7 0 0 0-7 7', play:'m8 4 12 8-12 8V4Z', pause:'M8 4v16M16 4v16', split:'M12 3v18M4 7l5 5-5 5m16-10-5 5 5 5', trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7', fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5', export:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', back:'m14 6-6 6 6 6', next:'m10 6 6 6-6 6', plus:'M12 4v16M4 12h16', new:'M14 2H5v20h14V7l-5-5Zm0 0v6h5', film:'M3 3h18v18H3V3Zm4 0v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4', audio:'M9 18V5l11-2v13M9 9l11-2M9 18c0 3-6 4-6 1s6-4 6-1Zm11-2c0 3-6 4-6 1s6-4 6-1Z'
};
const svg = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(icons[name] ?? icons.film).split(/(?=M)/).map(d=>`<path d="${d}"/>`).join('')}</svg>`;
const button = (id:string, icon:string, label:string, extra='') => `<button id="${id}" title="${label}" aria-label="${label}" ${extra}>${svg(icon)}<span>${label}</span></button>`;
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML = `
<header class="topbar"><a class="brand" href="./">ordo<span></span></a><span class="version">v0.2.0</span><div class="project-name"><input id="project-name" aria-label="Project name" maxlength="200" value="Untitled sequence"><span id="save-state">Not saved</span></div><button id="help" class="help-button">Quick guide</button>${button('fullscreen','fullscreen','Full screen')}${button('export','export','Export','class="accent"')}</header>
<nav class="toolbar" aria-label="Project tools">${button('new','new','New')}${button('open','open','Open')}${button('save','save','Save project')}<i></i>${button('import','import','Import media')}<i></i>${button('undo','undo','Undo')}${button('redo','redo','Redo')}<span class="toolbar-note">LOCAL EDITING · 720p / 30 fps</span></nav>
<main class="workspace"><section class="panel media-panel"><div class="panel-heading"><h2>Project media</h2><span id="media-count">0 items</span></div><div id="media-list" class="media-list"></div><p class="panel-foot">Files stay on your device.</p></section>
<section class="panel monitor"><div class="panel-heading"><h2>Program</h2><span>1280 × 720 · 30 fps</span></div><div class="screen"><canvas id="preview" width="1280" height="720" aria-label="Sequence preview"></canvas><div id="preview-empty" class="preview-empty">${svg('film')}<h2>Your story starts here</h2><p>Import media, then add clips to the timeline.</p><button id="import-empty" class="accent">Import media</button></div></div><div class="transport"><span id="current-time" class="timecode">00:00:00:00</span><div>${button('previous','back','Previous frame')}${button('play','play','Play / pause')}${button('next','next','Next frame')}</div><span id="total-time" class="timecode dim">00:00:00:00</span></div><input id="scrub" class="scrubber" type="range" min="0" max="0" value="0" aria-label="Sequence playhead"></section>
<section class="panel inspector"><div class="panel-heading"><h2>Clip properties</h2></div><div id="inspector"></div></section>
<section class="panel timeline-panel"><div class="panel-heading timeline-heading"><div><h2>Assembly timeline</h2><span>Single track · gaps close automatically</span></div><div class="timeline-tools">${button('split','split','Split')}${button('delete','trash','Delete')}${button('duplicate','plus','Duplicate')}<label class="zoom-label">Zoom<input id="zoom" type="range" min="12" max="120" value="48" aria-label="Timeline zoom"></label><button id="fit">Fit</button></div></div><div class="timeline-scroll" id="timeline-scroll"><div class="timeline-content" id="timeline-content"><div id="ruler" class="ruler"></div><div class="track-label">V / A</div><div id="clips" class="clips"></div><div id="playhead" class="playhead"><span></span></div></div></div><div class="timeline-footer"><span id="clip-count">0 clips</span><span>Space Play · S Split · Delete Remove · Ctrl+Z Undo</span></div></section></main>
<footer class="statusbar"><span id="status" role="status">Ready. Import video or audio to begin.</span><button id="recover" hidden>Restore autosave</button><a href="https://github.com/Averydimbulb79/Ordo" target="_blank" rel="noopener">GitHub ↗</a></footer>
<input id="media-file" type="file" accept="video/*,audio/*,.mkv,.mov,.wav,.mp3,.mp4,.webm" multiple hidden><input id="project-file" type="file" accept=".ordo,.json,application/json,application/octet-stream" hidden><input id="relink-file" type="file" accept="video/*,audio/*,.mkv,.mov,.wav,.mp3,.mp4,.webm" hidden>
<dialog id="export-dialog"><div class="dialog-head"><h2>Export sequence</h2><button id="close-export" aria-label="Close export">×</button></div><p>Render the edited timeline locally at 1280 × 720, 30 fps.</p><label>Format<select id="format"><option value="mp4">MP4 · H.264 / AAC</option><option value="webm">WebM · VP8 / Opus</option></select></label><p id="format-status">Checking encoders…</p><p class="note">Initial export limit: 2 minutes. Output is assembled in memory; keep this tab open. Muted clips stay muted.</p><progress id="export-progress" max="1" value="0"></progress><div class="dialog-actions"><button id="cancel-export" disabled>Cancel export</button><button id="start-export" class="accent">Export video</button></div></dialog>
<dialog id="help-dialog"><div class="dialog-head"><h2>Start your first edit</h2><button id="close-help" aria-label="Close guide">×</button></div><ol><li>Import video or audio. Click Add to sequence on a media card.</li><li>Click a timeline clip to select it. Drag clips to change their order.</li><li>Click the ruler to move the playhead. Press Space to play.</li><li>Press S to split the selected clip at the playhead.</li><li>Set source In and Out points in Clip properties, then Apply trim.</li><li>Save a .ordo project. Keep the original media; relink it after reopening.</li><li>Export up to 2 minutes as MP4 or WebM, depending on browser support.</li></ol><p>This is the first assembly editor. Multiple overlapping tracks, effects and titles come later.</p></dialog>`;

let project = fresh(), selected = '', dirty = false, busy = false, scale = 48, relinkId = '', saved = JSON.stringify(project);
const files = new Map<string,LocalMedia>(), history = new History();
let recovery: Project | null = null, controller: AbortController | null = null, autosaveTimer: ReturnType<typeof setTimeout>, checkSerial = 0;
const dbPromise = openDB('ordo-projects',1,{upgrade(db){db.createObjectStore('recovery');}});
const say = (s:string) => { $('status').textContent = s; };
const error = (e:unknown) => say(e instanceof Error ? e.message : String(e));
const preview = new Preview($<HTMLCanvasElement>('preview'), updateTime, updateButtons, say);
const current = () => project.clips.find(c=>c.id===selected);
const assetFor = (id:string) => project.assets.find(a=>a.id===id)!;
function updateTime(frame:number) {
 $('current-time').textContent=timecode(frame); $<HTMLInputElement>('scrub').value=String(frame);
 $('playhead').style.left=`${56+frame/30*scale}px`;
}
function updateButtons() {
 const set = (id:string,disabled:boolean) => { $<HTMLButtonElement>(id).disabled=disabled; };
 set('undo',busy||!history.canUndo);set('redo',busy||!history.canRedo);set('split',busy||!current());set('delete',busy||!current());set('duplicate',busy||!current());
 for(const id of ['play','previous','next','export'])set(id,busy||!project.clips.length);
 for(const id of ['new','open','import','save'])set(id,busy);
 $('play').innerHTML=svg(preview?.playing?'pause':'play')+'<span>Play / pause</span>';
}
function markDirty() { dirty=JSON.stringify(project)!==saved; $('save-state').textContent=dirty?'Unsaved changes':'Project saved'; }
function queueAutosave() {
 clearTimeout(autosaveTimer);
 autosaveTimer=setTimeout(async()=>{try{const db=await dbPromise;await db.put('recovery',JSON.stringify(project),'latest');say('Recovery snapshot saved locally. Save project to keep a portable copy.');}catch{say('Autosave storage unavailable. Use Save project regularly.');}},800);
}
function apply(next:Project, selection=selected) {
 history.push(project);project=next;selected=selection;markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();
}
function render() {
 $<HTMLInputElement>('project-name').value=project.name;
 $('media-count').textContent=`${project.assets.length} items`;
 $('media-list').replaceChildren();
 if(!project.assets.length){const empty=document.createElement('div');empty.className='bin-empty';empty.innerHTML=svg('import')+'<p>Import your footage<br>and sound.</p>';$('media-list').append(empty);}
 for(const asset of project.assets){
  const card=document.createElement('article');card.className='media-card';
  const badge=document.createElement('div');badge.className=`media-badge ${asset.kind}`;badge.innerHTML=svg(asset.kind==='video'?'film':'audio');
  const title=document.createElement('strong');title.textContent=asset.name;title.title=asset.name;
  const detail=document.createElement('small');detail.textContent=`${timecode(sourceFrames(asset))} · ${asset.kind==='video'?`${asset.width} × ${asset.height}`:'Audio'}${files.has(asset.id)?'':' · Missing'}`;
  const add=document.createElement('button');add.className='add-button';add.textContent='Add to sequence';add.disabled=busy||!files.has(asset.id);add.onclick=()=>{const id=crypto.randomUUID();const p=clone(project);p.clips.push({id,assetId:asset.id,inFrame:0,frames:sourceFrames(asset),volume:1});apply(p,id);};
  card.append(badge,title,detail,add);
  if(!files.has(asset.id)){const link=document.createElement('button');link.textContent='Relink';link.disabled=busy;link.onclick=()=>{relinkId=asset.id;$<HTMLInputElement>('relink-file').click();};card.append(link);}
  $('media-list').append(card);
 }
 const total=duration(project);$('total-time').textContent=timecode(total);$<HTMLInputElement>('scrub').max=String(Math.max(0,total-1));
 $('preview-empty').hidden=!!total;$('clip-count').textContent=`${project.clips.length} clips · ${timecode(total)}`;
 const width=Math.max(600,56+total/30*scale+100);$('timeline-content').style.width=`${width}px`;
 $('ruler').replaceChildren();const step=scale<24?10:scale<48?5:1;
 for(let second=0;second<=Math.max(total/30,10);second+=step){const tick=document.createElement('span');tick.style.left=`${56+second*scale}px`;tick.textContent=`${Math.floor(second/60)}:${String(second%60).padStart(2,'0')}`;$('ruler').append(tick);}
 $('clips').replaceChildren();let start=0;
 for(const clip of project.clips){
  const asset=assetFor(clip.assetId),node=document.createElement('button');node.className=`clip ${asset.kind} ${selected===clip.id?'selected':''} ${files.has(asset.id)?'':'missing'}`;node.draggable=!busy;node.disabled=busy;node.dataset.id=clip.id;
  node.style.left=`${56+start/30*scale}px`;node.style.width=`${Math.max(2,clip.frames/30*scale)}px`;node.title=`${asset.name} · ${timecode(clip.frames)}`;
  const name=document.createElement('span');name.textContent=asset.name;const length=document.createElement('small');length.textContent=timecode(clip.frames);node.append(name,length);
  for(const side of ['in','out']){const handle=document.createElement('span');handle.className='trim-handle';handle.dataset.side=side;handle.setAttribute('aria-hidden','true');node.append(handle);}
  const clipStart=start;
  node.onclick=()=>{if(busy)return;selected=clip.id;renderSelection();void preview.seek(clipStart);};
  node.ondragstart=e=>{e.dataTransfer?.setData('text/ordo-clip',clip.id);};
  node.ondragover=e=>{if(!busy)e.preventDefault();};
  node.ondrop=e=>{e.preventDefault();if(busy)return;const id=e.dataTransfer?.getData('text/ordo-clip');if(!id||id===clip.id)return;const p=clone(project),from=p.clips.findIndex(c=>c.id===id);if(from<0)return;const [moved]=p.clips.splice(from,1);const target=p.clips.findIndex(c=>c.id===clip.id);p.clips.splice(target,0,moved);apply(p,id);};
  $('clips').append(node);start+=clip.frames;
 }
 renderSelection();updateTime(Math.min(preview.frame,Math.max(0,total-1)));updateButtons();
}
function renderSelection(){
 document.querySelectorAll<HTMLElement>('.clip').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected));
 const c=current();const box=$('inspector');box.replaceChildren();
 if(!c){box.innerHTML='<div class="inspector-empty">Select a timeline clip to adjust its source range and volume.</div>';updateButtons();return;}
 const a=assetFor(c.assetId),heading=document.createElement('h3');heading.textContent=a.name;box.append(heading);
 const fields=document.createElement('div');fields.innerHTML=`<div class="property-caption">SOURCE RANGE · FRAMES AT 30 FPS</div><label>In frame<input id="trim-in" type="number" min="0" step="1" value="${c.inFrame}"></label><label>Out frame (exclusive)<input id="trim-out" type="number" min="1" step="1" value="${c.inFrame+c.frames}"></label><div class="range-actions"><button id="mark-in">In at playhead</button><button id="mark-out">Out at playhead</button></div><button id="apply-trim" class="wide">Apply trim</button><p class="note">Source length: ${sourceFrames(a)} frames. Trimming closes the gap.</p><label class="volume-label">Volume <span id="volume-value">${Math.round(c.volume*100)}%</span><input id="volume" type="range" min="0" max="100" value="${Math.round(c.volume*100)}"></label><div class="range-actions"><button id="move-left">Move earlier</button><button id="move-right">Move later</button></div><button id="remove-clip" class="wide danger">Remove clip</button>`;box.append(fields);
 $('apply-trim').onclick=()=>{try{apply(trim(project,c.id,Number($<HTMLInputElement>('trim-in').value),Number($<HTMLInputElement>('trim-out').value)));}catch(e){error(e);}};
 const sourcePlayhead=()=>{const position=locate(project,preview.frame);if(position?.clip.id!==c.id)throw new Error('Move the playhead into the selected clip first.');return c.inFrame+position.offset;};
 $('mark-in').onclick=()=>{try{$<HTMLInputElement>('trim-in').value=String(sourcePlayhead());}catch(e){error(e);}};
 $('mark-out').onclick=()=>{try{$<HTMLInputElement>('trim-out').value=String(sourcePlayhead()+1);}catch(e){error(e);}};
 $('volume').oninput=()=>{$('volume-value').textContent=$<HTMLInputElement>('volume').value+'%';};
 $('volume').onchange=()=>{const p=clone(project);p.clips.find(x=>x.id===c.id)!.volume=Number($<HTMLInputElement>('volume').value)/100;apply(p);};
 $('move-left').onclick=()=>move(-1);$('move-right').onclick=()=>move(1);$('remove-clip').onclick=remove;
 for(const el of box.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))el.disabled=busy;
 updateButtons();
}
function move(delta:number){const i=project.clips.findIndex(c=>c.id===selected),j=i+delta;if(i<0||j<0||j>=project.clips.length)return;const p=clone(project);[p.clips[i],p.clips[j]]=[p.clips[j],p.clips[i]];apply(p);}
function remove(){if(busy||!current())return;const p=clone(project);p.clips=p.clips.filter(c=>c.id!==selected);apply(p,'');}
function setBusy(value:boolean){busy=value;$<HTMLInputElement>('project-name').disabled=value;$<HTMLInputElement>('scrub').disabled=value;render();}
function confirmDiscard(){return !dirty||confirm('Unsaved changes will be replaced. Save your project first if you need to keep them. Continue?');}
function resetTo(p:Project){clearTimeout(autosaveTimer);project=p;selected='';history.clear();saved=JSON.stringify(project);dirty=false;preview.setProject(project,files);render();void preview.seek(0);$('save-state').textContent='Project opened';queueAutosave();}
function collectUnused(){for(const [id,local] of files){if(!project.assets.some(a=>a.id===id)){URL.revokeObjectURL(local.url);files.delete(id);}}}

$('new').onclick=()=>{if(confirmDiscard()){resetTo(fresh());collectUnused();say('New sequence.');}};
$('open').onclick=()=>$<HTMLInputElement>('project-file').click();
$('save').onclick=async()=>{
 if(busy)return;preview.pause();setBusy(true);
 try{const snapshot=JSON.stringify(project);const outcome=await download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${project.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'Ordo'}.ordo`);
  if(outcome==='cancelled'){say('Save cancelled. Your edit remains open.');return;}saved=snapshot;markDirty();say(outcome==='saved'?'Project saved. Keep your original media for reopening.':'Project download requested. Keep your original media for reopening.');
 }catch(e){error(e);}finally{setBusy(false);}
};
for(const id of ['import','import-empty'])$(id).onclick=()=>$<HTMLInputElement>('media-file').click();
$('undo').onclick=()=>{if(busy)return;project=history.undo(project);selected=project.clips.some(c=>c.id===selected)?selected:'';markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();};
$('redo').onclick=()=>{if(busy)return;project=history.redo(project);markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();};
$('split').onclick=()=>{try{if(!busy)apply(split(project,selected,preview.frame,crypto.randomUUID()));}catch(e){error(e);}};
$('delete').onclick=remove;
$('duplicate').onclick=()=>{if(busy)return;const index=project.clips.findIndex(c=>c.id===selected);if(index<0)return;const p=clone(project),id=crypto.randomUUID();p.clips.splice(index+1,0,{...p.clips[index],id});apply(p,id);};
$('play').onclick=()=>{if(!busy)void preview.toggle();};$('previous').onclick=()=>{if(!busy)void preview.seek(preview.frame-1);};$('next').onclick=()=>{if(!busy)void preview.seek(preview.frame+1);};
$('scrub').oninput=()=>{if(!busy)void preview.seek(Number($<HTMLInputElement>('scrub').value));};
$('ruler').onclick=e=>{if(busy)return;const x=e.clientX-$('timeline-content').getBoundingClientRect().left-56;void preview.seek(x/scale*30);};
$('zoom').oninput=()=>{scale=Number($<HTMLInputElement>('zoom').value);render();};
$('fit').onclick=()=>{scale=Math.max(12,Math.min(120,($('timeline-scroll').clientWidth-100)/Math.max(1,duration(project)/30)));$<HTMLInputElement>('zoom').value=String(scale);render();};
$('project-name').onchange=()=>{const p=clone(project);p.name=$<HTMLInputElement>('project-name').value.trim()||'Untitled sequence';apply(p);};
$('fullscreen').onclick=()=>{void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(error);};
$('help').onclick=()=>$<HTMLDialogElement>('help-dialog').showModal();$('close-help').onclick=()=>$<HTMLDialogElement>('help-dialog').close();

$<HTMLInputElement>('media-file').onchange=async()=>{
 const input=$<HTMLInputElement>('media-file'), chosen=Array.from(input.files??[]);input.value='';if(!chosen.length||busy)return;
 preview.pause();setBusy(true);const p=clone(project);let added=0;const failures:string[]=[];
 for(const file of chosen){try{say(`Reading ${file.name}…`);if(p.assets.some(a=>a.name===file.name&&a.size===file.size&&a.modified===file.lastModified))continue;const a=await inspect(file);p.assets.push(a);files.set(a.id,{file,url:URL.createObjectURL(file)});added++;}catch(e){failures.push(`${file.name}: ${e instanceof Error?e.message:String(e)}`);}}
 setBusy(false);if(added)apply(p);say(`${added} file(s) imported.${failures.length?' '+failures.join(' · '):' Use Add to sequence to start editing.'}`);
};
$<HTMLInputElement>('project-file').onchange=async()=>{
 const input=$<HTMLInputElement>('project-file'),file=input.files?.[0];input.value='';if(!file||busy)return;preview.pause();
 try{if(file.size>5_000_000)throw new Error('Project files must be smaller than 5 MB.');const p=parseProject(await file.text());if(!confirmDiscard())return;
  const known=project.assets.map(a=>({a,local:files.get(a.id)}));
  const matched = new Map<string,LocalMedia>();
  for(const a of p.assets){const old=known.find(k=>k.local&&k.a.name===a.name&&k.a.size===a.size&&k.a.modified===a.modified&&k.a.kind===a.kind);if(old?.local)matched.set(a.id,{file:old.local.file,url:URL.createObjectURL(old.local.file)});}
  preview.pause();for(const local of files.values())URL.revokeObjectURL(local.url);files.clear();for(const [id,local] of matched)files.set(id,local);
  resetTo(p);collectUnused();say('Project opened. Relink any missing files in Project media.');
 }catch(e){error(e);}
};
$<HTMLInputElement>('relink-file').onchange=async()=>{
 const input=$<HTMLInputElement>('relink-file'),file=input.files?.[0],id=relinkId;input.value='';if(!file||busy)return;
 try{const original=assetFor(id);if(!original)return;if(file.name!==original.name||file.size!==original.size)throw new Error('Choose the original file with the same name and size.');setBusy(true);const a=await inspect(file);if(Math.abs(a.duration-original.duration)>1/30||a.kind!==original.kind||a.width!==original.width||a.height!==original.height)throw new Error('This media does not match the saved source.');const previous=files.get(id);if(previous)URL.revokeObjectURL(previous.url);files.set(id,{file,url:URL.createObjectURL(file)});say('Media relinked.');}catch(e){error(e);}finally{setBusy(false);void preview.seek(preview.frame);}
};
async function checkFormat(){
 const serial=++checkSerial,format=$<HTMLSelectElement>('format').value as Format;
 $('format-status').textContent='Checking browser encoders…';$<HTMLButtonElement>('start-export').disabled=true;
 // Every source may contain audio, so preflight conservatively checks both codecs.
 const ok=await supported(format,project.clips.some(c=>c.volume>0));if(serial!==checkSerial)return;
 $('format-status').textContent=ok?`${format.toUpperCase()} encoder checks passed. Source decoding will be checked during export.`:`${format.toUpperCase()} is unavailable here. Try the other format.`;
 $<HTMLButtonElement>('start-export').disabled=!ok||busy||!project.clips.length||duration(project)>LIMIT_SECONDS*30;
 if(duration(project)>LIMIT_SECONDS*30)$('format-status').textContent='Shorten the sequence to 2 minutes or less for this initial export release.';
}
$('export').onclick=()=>{preview.pause();$<HTMLProgressElement>('export-progress').value=0;$<HTMLDialogElement>('export-dialog').showModal();void checkFormat();};
$('format').onchange=()=>void checkFormat();
$('close-export').onclick=()=>{if(!controller)$<HTMLDialogElement>('export-dialog').close();};
$('export-dialog').addEventListener('cancel',e=>{if(controller)e.preventDefault();});
$('cancel-export').onclick=()=>{controller?.abort();$('format-status').textContent='Cancelling…';};
$('start-export').onclick=async()=>{
 if(busy)return;const format=$<HTMLSelectElement>('format').value as Format;controller=new AbortController();setBusy(true);void keepAwake(true).catch(()=>{});
 $<HTMLButtonElement>('start-export').disabled=true;$<HTMLButtonElement>('cancel-export').disabled=false;$<HTMLSelectElement>('format').disabled=true;$<HTMLButtonElement>('close-export').disabled=true;
 try{const blob=await exportSequence(clone(project),files,format,controller.signal,(n,phase)=>{$<HTMLProgressElement>('export-progress').value=n;$('format-status').textContent=`${phase} · ${Math.round(n*100)}%`;});const outcome=await download(blob,`${project.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'Ordo'}.${format}`);$('format-status').textContent=outcome==='saved'?'Video saved to your chosen location.':outcome==='cancelled'?'Saving cancelled. Export again to save a copy.':'Export complete. Download requested.';say($('format-status').textContent!);}
 catch(e){$('format-status').textContent=e instanceof Error?e.message:String(e);error(e);}
 finally{controller=null;void keepAwake(false).catch(()=>{});setBusy(false);$<HTMLButtonElement>('cancel-export').disabled=true;$<HTMLSelectElement>('format').disabled=false;$<HTMLButtonElement>('close-export').disabled=false;$<HTMLButtonElement>('start-export').disabled=false;}
};
$('recover').onclick=()=>{if(!busy&&recovery&&confirmDiscard()){resetTo(clone(recovery));saved='';markDirty();$('recover').hidden=true;say('Recovery restored. Relink media and save a project copy.');}};
void dbPromise.then(async db=>{const text=await db.get('recovery','latest');if(text){try{recovery=parseProject(text);$('recover').hidden=false;}catch{say('An older recovery snapshot could not be opened.');}}}).catch(()=>say('Local recovery storage unavailable. Save project files regularly.'));
window.addEventListener('beforeunload',event=>{if(dirty||controller){event.preventDefault();event.returnValue='';}});
window.addEventListener('keydown',event=>{
 const target=event.target as HTMLElement;if(document.body.classList.contains('sheet-visible'))return;
 if(busy||target.matches('input,textarea,select')||target.isContentEditable||document.querySelector('dialog[open]'))return;
 const mod=event.ctrlKey||event.metaKey;
 if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();$('save').click();}
 else if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();$(event.shiftKey?'redo':'undo').click();}
 else if(mod&&event.key.toLowerCase()==='y'){event.preventDefault();$('redo').click();}
 else if(event.code==='Space'){event.preventDefault();$('play').click();}
 else if(event.key.toLowerCase()==='s'&&!mod){event.preventDefault();$('split').click();}
 else if(['Delete','Backspace'].includes(event.key)){event.preventDefault();remove();}
 else if(event.key==='ArrowLeft'){event.preventDefault();$('previous').click();}
 else if(event.key==='ArrowRight'){event.preventDefault();$('next').click();}
});
preview.setProject(project,files);
render();
const mobile = setupMobile({
 isBusy:()=>busy,
 seek:frame=>{if(!busy)void preview.seek(frame);},
 getScale:()=>scale,
 setScale:value=>{scale=value;$<HTMLInputElement>('zoom').value=String(value);render();},
 trimRange:id=>{const c=project.clips.find(c=>c.id===id);return c?{inFrame:c.inFrame,outFrame:c.inFrame+c.frames,sourceFrames:sourceFrames(assetFor(c.assetId))}:null;},
 commitTrim:(id,inFrame,outFrame)=>{if(busy)return;try{apply(trim(project,id,inFrame,outFrame),id);}catch(e){error(e);}}
});
if(isAndroid){document.body.classList.add('android-app');$('fullscreen').hidden=true;}
document.addEventListener('visibilitychange',()=>{if(document.hidden)preview.pause();});
window.addEventListener('ordo-back',()=>{
 const dialog=document.querySelector<HTMLDialogElement>('dialog[open]');
 if(dialog){if(controller){if(confirm('Cancel the export?'))controller.abort();}else dialog.close();return;}
 if(mobile.closeSheet())return;
 if(busy){say('Please finish the current operation first.');return;}
 if(!dirty||confirm('Exit Ordo? Save your project first to keep a portable copy of your edits.'))void exitAndroid();
});
