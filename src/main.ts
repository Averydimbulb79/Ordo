import { disconnectAudioJoins } from './audio-model';
import { fileHash, sameSource, relinkCandidates } from './media-identity';
import { remembersMedia, setRemembersMedia, rememberMedia, restoreMedia, nativeFile, forgetMedia } from './media-memory';
import { pickNativeMedia } from './native';
import type { NativeMedia } from './native';
import { EXPORT_FORMATS } from './export-formats';
import { setupPreviewFullscreen } from './preview-fullscreen';
import { appendMedia } from './bulk';
import { setupCreative } from './creative';
import { exportDimensions } from './export-settings';
import type { ExportSettings } from './export-settings';
import { TRANSITIONS } from './creative-model';
import { isAndroid, keepAwake, exitAndroid } from './native';
import { setupMobile } from './mobile';
import { openDB } from 'idb';
import { clone, duration, fresh, History, placements, layersAt, trackOf, TRACKS, transitionLength, validateTracks, parseProject, sourceFrames, defaultFrames, split, timecode, trim } from './model';
import type { Asset, Project, Track } from './model';
import { download, inspect } from './media';
import type { LocalMedia } from './media';
import { Preview } from './preview';
import { exportSequence, supported } from './export';
import { exportNative, nativeReason, NativeSaveError } from './native-export';
import type { Format } from './export';
import { thumbnail, mediaLength } from './thumbnails';
import './style.css';

const icons: Record<string,string> = {transitions:'M3 4h8v16H3V4Zm10 0h8v16h-8M5 8l4 4-4 4m14-8-4 4 4 4',title:'M4 5h16M12 5v15M8 20h8',captions:'M3 5h18v14H3V5Zm3 5h4m-4 4h4m4-4h4m-4 4h4',adjust:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M9 15v6',crop:'M7 3v14h14M3 7h14v14',
 import:'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5', open:'M3 7h7l2 3h9l-3 10H3V7Zm0 0V4h7l2 3h7v3', save:'M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7', undo:'M9 4 3 10l6 6M3 10h10a7 7 0 0 1 7 7', redo:'m15 4 6 6-6 6m6-6H11a7 7 0 0 0-7 7', play:'m8 4 12 8-12 8V4Z', pause:'M8 4v16M16 4v16', split:'M12 3v18M4 7l5 5-5 5m16-10-5 5 5 5', trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7', fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5', export:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', back:'m14 6-6 6 6 6', next:'m10 6 6 6-6 6', plus:'M12 4v16M4 12h16', new:'M14 2H5v20h14V7l-5-5Zm0 0v6h5', film:'M3 3h18v18H3V3Zm4 0v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4', audio:'M9 18V5l11-2v13M9 9l11-2M9 18c0 3-6 4-6 1s6-4 6-1Zm11-2c0 3-6 4-6 1s6-4 6-1Z'
};
const svg = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(icons[name] ?? icons.film).split(/(?=M)/).map(d=>`<path d="${d}"/>`).join('')}</svg>`;
const button = (id:string, icon:string, label:string, extra='') => `<button id="${id}" title="${label}" aria-label="${label}" ${extra}>${svg(icon)}<span>${label}</span></button>`;
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML = `
<header class="topbar"><a class="brand" href="./">ordo<span></span></a><span class="version">v0.7.0</span><div class="project-name"><input id="project-name" aria-label="Project name" maxlength="200" value="Untitled sequence"><span id="save-state">Not saved</span></div><button id="help" class="help-button">Quick guide</button>${button('fullscreen','fullscreen','Full screen')}${button('export','export','Export','class="accent"')}</header>
<nav class="toolbar" aria-label="Project tools">${button('new','new','New')}${button('open','open','Open')}${button('save','save','Save project')}<i></i>${button('import','import','Import media')}<i></i>${button('undo','undo','Undo')}${button('redo','redo','Redo')}<div class="creative-tools">${button('tool-transitions','transitions','Transitions')}${button('tool-title','title','Title')}${button('tool-captions','captions','Captions')}${button('tool-adjust','adjust','Adjust')}${button('tool-crop','crop','Crop')}</div><span class="toolbar-note">LOCAL EDITING · 720p / 30 fps</span></nav>
<main class="workspace"><section class="panel media-panel"><div class="panel-heading"><h2>Project media</h2><span id="media-count">0 items</span></div><p id="import-feedback" class="import-feedback" role="status" aria-live="polite" aria-atomic="true" hidden></p><div class="bulk-media"><label>Pictures<select id="bulk-video"><option value="v1">V1 · Main</option><option value="v2">V2 · Overlay</option></select></label><label>Audio<select id="bulk-audio"><option value="a1">A1</option><option value="a2">A2</option></select></label><button id="add-all-media" class="accent">Add all media</button></div><div class="media-memory-tools"><button id="locate-media" hidden>Locate missing media</button><details class="media-storage"><summary>Media storage</summary><label class="bulk-option"><input id="remember-media" type="checkbox"> Remember media on this device</label><p class="note">Android remembers permitted file access. Other files are stored as local copies when space allows.</p><button id="forget-media">Forget remembered media</button></details></div><div id="media-list" class="media-list"></div><p class="panel-foot">Files stay on your device.</p></section>
<section class="panel monitor"><div class="panel-heading"><h2>Program</h2><span id="program-settings">1280 × 720 · 30 fps</span></div><div class="screen"><canvas id="preview" width="1280" height="720" aria-label="Sequence preview"></canvas><div id="preview-empty" class="preview-empty">${svg('film')}<h2 id="empty-heading">Your story starts here</h2><p id="empty-description">Import media, then add clips to the timeline.</p><button id="import-empty" class="accent">Import media</button></div>${button('preview-fullscreen','fullscreen','Fullscreen preview','aria-pressed="false"')}</div><div class="transport"><span id="current-time" class="timecode">00:00:00:00</span><div>${button('previous','back','Previous frame')}${button('play','play','Play / pause')}${button('next','next','Next frame')}</div><span id="total-time" class="timecode dim">00:00:00:00</span></div><div class="compare-bar"><label><input id="compare-adjustments" type="checkbox" checked> Adjusted</label></div><input id="scrub" class="scrubber" type="range" min="0" max="0" value="0" aria-label="Sequence playhead"></section>
<section class="panel inspector"><div class="panel-heading"><h2>Clip properties</h2></div><div id="inspector"></div></section>
<section class="panel timeline-panel"><div class="panel-heading timeline-heading"><div><h2>Multitrack timeline</h2><span>V1 assembly · V2 overlay · A1 / A2 audio</span></div><div class="timeline-tools">${button('split','split','Split')}${button('delete','trash','Delete')}${button('duplicate','plus','Duplicate')}<label class="zoom-label">Zoom<input id="zoom" type="range" min="12" max="120" value="48" aria-label="Timeline zoom"></label><button id="fit">Fit</button></div></div><div class="timeline-scroll" id="timeline-scroll"><div class="timeline-content" id="timeline-content"><div id="ruler" class="ruler"></div><div id="track-labels"></div><div id="clips" class="clips"></div><div id="playhead" class="playhead"><span></span></div></div></div><div class="timeline-footer"><span id="clip-count">0 clips</span><span>Space Play · S Split · Delete Remove · Ctrl+Z Undo</span></div></section></main>
<footer class="statusbar"><span id="status" role="status">Ready. Import video, audio or images to begin.</span><button id="recover" hidden>Restore autosave</button><a href="https://github.com/Averydimbulb79/Ordo" target="_blank" rel="noopener">GitHub ↗</a></footer>
<input id="media-file" type="file" accept="video/*,audio/*,image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,.mkv,.mov,.wav,.mp3,.mp4,.webm" multiple hidden><input id="locate-files" type="file" accept="video/*,audio/*,image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,.mkv,.mov,.wav,.mp3,.mp4,.webm" multiple hidden><input id="project-file" type="file" accept=".ordo,.json,application/json,application/octet-stream" hidden><input id="relink-file" type="file" accept="video/*,audio/*,image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,.mkv,.mov,.wav,.mp3,.mp4,.webm" hidden>
<dialog id="export-dialog"><div class="dialog-head"><h2>Export sequence</h2><button id="close-export" aria-label="Close export">×</button></div><p id="export-description">Render your edited timeline locally.</p><label>Format<select id="format"><option value="mp4">MP4 · H.264 / AAC</option><option value="mp4-hevc">MP4 · H.265 (HEVC) / AAC</option><option value="webm">WebM · VP8 / Opus</option></select></label><div class="form-grid"><label>Resolution<select id="export-resolution"><option value="480">480p</option><option value="720" selected>720p</option><option value="1080">1080p · Full HD</option><option value="2160">2160p · 4K</option></select></label><label>Frame rate<select id="export-fps"><option>24</option><option>25</option><option selected>30</option><option>50</option><option>60</option></select></label><label>Quality<select id="export-quality"><option value="compact">Compact</option><option value="standard" selected>Standard</option><option value="high">High</option></select></label></div><p id="format-status">Checking encoders…</p><p class="note">No fixed export duration limit. Longer exports need more memory. Keep Ordo open until saving finishes. Muted clips stay muted.</p><progress id="export-progress" max="1" value="0"></progress><div class="dialog-actions"><button id="cancel-export" disabled>Cancel export</button><button id="start-export" class="accent">Export video</button></div></dialog>
<dialog id="help-dialog"><div class="dialog-head"><h2>Start your first edit</h2><button id="close-help" aria-label="Close guide">×</button></div><ol><li>Import video, audio or images. Choose a destination track, then Add to sequence on a media card. V2 starts as picture-in-picture; A1/A2 carry sound.</li><li>Click a timeline clip to select it. Reorder V1 clips by dragging. Use Clip settings for track, start time and picture placement.</li><li>Click the ruler to move the playhead. Press Space to play.</li><li>Press S to split the selected clip at the playhead.</li><li>Set source In and Out points in Clip properties, then Apply trim.</li><li>Save a .ordo project. Keep the original media; relink it after reopening.</li><li>Export as MP4 or WebM using the resolution, frame rate and quality supported by your device.</li></ol><p>Four tracks support layered video and independent sound. Use Transitions for Start, End or Between effects. Titles and captions have their own tools.</p></dialog>`;

let project = fresh(), selected = '', dirty = false, busy = false, scale = 48, relinkId = '', saved = JSON.stringify(project);
let importNotice = '', importFailed = false, importing = false;
const recentImports = new Set<string>();
const destinations=new Map<string,Track>();
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
 for(const id of ['play','previous','next','export','compare-adjustments','preview-fullscreen'])set(id,busy||!duration(project));
 for(const id of ['new','open','import','import-empty','save','tool-transitions','tool-title','tool-captions','tool-adjust','tool-crop'])set(id,busy);
 $('play').innerHTML=svg(preview?.playing?'pause':'play')+'<span>Play / pause</span>';
}
function markDirty() { dirty=JSON.stringify(project)!==saved; $('save-state').textContent=dirty?'Unsaved changes':'Project saved'; }
function queueAutosave() {
 clearTimeout(autosaveTimer);
 autosaveTimer=setTimeout(async()=>{try{const db=await dbPromise;await db.put('recovery',JSON.stringify(project),'latest');say('Recovery snapshot saved locally. Save project to keep a portable copy.');}catch{say('Autosave storage unavailable. Use Save project regularly.');}},800);
}
function apply(next:Project, selection=selected) {
 next=parseProject(JSON.stringify(next));validateTracks(next);history.push(project);project=next;selected=selection;markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();
}
function render() {
 const canvas=$<HTMLCanvasElement>("preview");if(canvas.width!==project.width||canvas.height!==project.height){canvas.width=project.width;canvas.height=project.height;}$("program-settings").textContent=`${project.width} × ${project.height} · 30 fps`;
 $<HTMLInputElement>('project-name').value=project.name;
 const missing=project.assets.filter(a=>!files.has(a.id)).length;$<HTMLButtonElement>('locate-media').disabled=busy||!missing;$('locate-media').hidden=!missing;$('locate-media').textContent=`Locate missing media${missing?' ('+missing+')':''}`;
 $<HTMLButtonElement>('forget-media').disabled=busy;$<HTMLInputElement>('remember-media').checked=remembersMedia();$<HTMLInputElement>('remember-media').disabled=busy;
 $<HTMLButtonElement>('add-all-media').disabled=busy||!project.assets.some(a=>files.has(a.id));
 $('media-count').textContent=`${project.assets.length} ${project.assets.length===1?'item':'items'}`;
 const extraImport=document.getElementById('mobile-import');if(extraImport){extraImport.textContent=project.assets.length?'Import more':'Import media';extraImport.classList.toggle('accent',!project.assets.length);}
 $('import-feedback').textContent=importNotice;
 $('import-feedback').hidden=!importNotice;
 $('import-feedback').classList.toggle('is-error',importFailed);
 document.querySelector('.media-panel')!.setAttribute('aria-busy',String(importing));
 $('media-list').replaceChildren();
 if(!project.assets.length){const empty=document.createElement('div');empty.className='bin-empty';empty.innerHTML=svg('import')+'<p>Import video, images<br>and sound.</p>';$('media-list').append(empty);}
 for(const asset of project.assets){
  const card=document.createElement('article');card.className='media-card';card.dataset.assetId=asset.id;card.classList.toggle('just-imported',recentImports.has(asset.id));
  const badge=document.createElement('div');badge.className=`media-badge ${asset.kind}`;badge.innerHTML=svg(asset.kind!=='audio'?'film':'audio');
  const local=files.get(asset.id);
  if(asset.kind!=='audio'&&local)void thumbnail(local.file).then(url=>{if(!badge.isConnected||!url)return;const image=document.createElement('img');image.alt=`Thumbnail for ${asset.name}`;image.src=url;badge.replaceChildren(image,lengthBadge);});
  const lengthBadge=document.createElement('span');lengthBadge.className='media-duration';lengthBadge.textContent=mediaLength(asset.duration);lengthBadge.setAttribute('aria-label',`Duration ${mediaLength(asset.duration)}`);badge.append(lengthBadge);
  const title=document.createElement('strong');title.textContent=asset.name;title.title=asset.name;
  const detail=document.createElement('small');detail.textContent=`${asset.kind!=='audio'?`${asset.kind==='image'?'Image · ':''}${asset.width} × ${asset.height}`:'Audio'}${files.has(asset.id)?'':' · Missing'}${project.clips.some(c=>c.assetId===asset.id)?' · In timeline':recentImports.has(asset.id)?' · Ready to add':''}`;
  const destination=document.createElement('label');destination.className='media-destination';destination.textContent='Add to';
  const track=document.createElement('select');track.setAttribute('aria-label',`Destination for ${asset.name}`);
  for(const id of TRACKS.filter(id=>asset.kind!=='image'||!id.startsWith('a'))){const option=document.createElement('option');option.value=id;option.textContent=trackName(id);track.append(option);}
  track.value=destinations.get(asset.id)??(asset.kind==='audio'?'a1':'v1');track.disabled=busy;track.onchange=()=>destinations.set(asset.id,track.value as Track);destination.append(track);
  const add=document.createElement('button');add.className='add-button accent';add.textContent='Add to sequence';add.disabled=busy||!files.has(asset.id);add.onclick=()=>{
   const id=crypto.randomUUID(),p=clone(project),target=track.value as Track;
   const end=Math.max(0,...placements(p).filter(e=>e.track===target).map(e=>e.end));
   p.clips.push({id,assetId:asset.id,inFrame:0,frames:defaultFrames(asset),volume:1,...(target==='v1'?{}:{track:target,startFrame:Math.max(preview.frame,end)}),...(target==='v2'?{scale:.4,x:.75,y:.75}:{})});
   try{apply(p,id);say(`Added ${asset.name} to ${target.toUpperCase()}.`);}catch(e){error(e);}
  };
  card.append(badge,title,detail,destination,add);
  if(!files.has(asset.id)){const link=document.createElement('button');link.textContent='Relink';link.disabled=busy;link.onclick=()=>{relinkId=asset.id;if(isAndroid)void chooseNative(true,asset.id);else $<HTMLInputElement>('relink-file').click();};card.append(link);}
  $('media-list').append(card);
 }
 const ready=project.assets.filter(a=>files.has(a.id)).length;
 $('empty-heading').textContent=importing?'Importing media…':ready?'Your media is ready':project.assets.length?'Relink your media':importFailed?'Import needs attention':'Your story starts here';
 $('empty-description').textContent=importing?importNotice:ready?`${ready} ${ready===1?'file is':'files are'} in Project media. Choose a clip and tap Add to sequence.`:project.assets.length?'Open Project media and relink the original files to start editing.':importFailed?'Open Project media for details, or try importing another file.':'Import media, then add clips to the timeline.';
 $('import-empty').textContent=importing?'Reading files…':project.assets.length?'Choose clips':importFailed?'View import details':'Import media';
 const total=duration(project);$('total-time').textContent=timecode(total);$<HTMLInputElement>('scrub').max=String(Math.max(0,total-1));
 $('preview-empty').hidden=!!total;$('clip-count').textContent=`${project.clips.length} clips · ${timecode(total)}`;
 const width=Math.max(600,56+total/30*scale+100);$('timeline-content').style.width=`${width}px`;
 $('ruler').replaceChildren();const step=scale<24?10:scale<48?5:1;
 for(let second=0;second<=Math.max(total/30,10);second+=step){const tick=document.createElement('span');tick.style.left=`${56+second*scale}px`;tick.textContent=`${Math.floor(second/60)}:${String(second%60).padStart(2,'0')}`;$('ruler').append(tick);}
 $('clips').replaceChildren();$('track-labels').replaceChildren();
 $('timeline-content').style.minHeight='347px';$('clips').style.height='312px';
 for(const [row,track] of [...TRACKS,'T','C'].entries()){const label=document.createElement('div');label.className='track-label';label.style.top=`${row*52}px`;label.textContent=track.toUpperCase();label.title=track==='T'?'Titles':track==='C'?'Captions':trackName(track as Track);$('track-labels').append(label);}
 for(const entry of placements(project)){
  const {clip,start,track}=entry;
  const asset=assetFor(clip.assetId),node=document.createElement('button');node.className=`clip ${asset.kind} ${selected===clip.id?'selected':''} ${files.has(asset.id)?'':'missing'}`;node.draggable=!busy;node.disabled=busy;node.dataset.id=clip.id;node.dataset.track=track;node.style.top=`${4+TRACKS.indexOf(track)*52}px`;
  node.style.left=`${56+start/30*scale}px`;node.style.width=`${Math.max(2,clip.frames/30*scale)}px`;node.title=`${asset.name} · ${timecode(clip.frames)}`;
  const name=document.createElement('span');name.textContent=asset.name;const length=document.createElement('small');length.textContent=timecode(clip.frames);node.append(name,length);if(clip.audio?.fadeIn||clip.audio?.fadeOut){const fade=document.createElement('small');fade.className='audio-fade-label';fade.textContent=[clip.audio.fadeIn?'↗ '+clip.audio.fadeIn+'s':'',clip.audio.fadeOut?'↘ '+clip.audio.fadeOut+'s':''].filter(Boolean).join(' · ');length.append(document.createTextNode(' · '+fade.textContent));}
  for(const side of ['in','out']){const handle=document.createElement('span');handle.className='trim-handle';handle.dataset.side=side;handle.setAttribute('aria-hidden','true');node.append(handle);}
  const clipStart=start;
  node.onclick=()=>{if(busy)return;selected=clip.id;renderSelection();void preview.seek(clipStart);};
  node.ondragstart=e=>{e.dataTransfer?.setData('text/ordo-clip',clip.id);};
  node.ondragover=e=>{if(!busy)e.preventDefault();};
  node.ondrop=e=>{e.preventDefault();if(busy)return;const id=e.dataTransfer?.getData('text/ordo-clip');if(!id||id===clip.id)return;if(track!=='v1'||trackOf(project.clips.find(c=>c.id===id)!)!=='v1'){say('Use Clip settings to change the track and start time.');return;}const p=clone(project),from=p.clips.findIndex(c=>c.id===id);if(from<0)return;const [moved]=p.clips.splice(from,1);const target=p.clips.findIndex(c=>c.id===clip.id);p.clips.splice(target,0,moved);apply(p,id);};
  $('clips').append(node);
  if(clip.startTransition||clip.endTransition){const edges=document.createElement('span');edges.className='clip-edge-label';edges.textContent=[clip.startTransition?'Start '+(Math.min(clip.startTransition.frames,clip.frames)/30).toFixed(1)+'s':'',clip.endTransition?'End '+(Math.min(clip.endTransition.frames,clip.frames)/30).toFixed(1)+'s':''].filter(Boolean).join(' · ');node.append(edges);}
  if(clip.audioCrossfadeFrames){const marker=document.createElement('button');marker.className='audio-transition-marker';marker.style.top=`${34+TRACKS.indexOf(track)*52}px`;marker.style.left=`${56+(entry.end-clip.audioCrossfadeFrames)/30*scale}px`;marker.style.width=`${Math.max(30,clip.audioCrossfadeFrames/30*scale)}px`;marker.textContent='Crossfade';marker.setAttribute('aria-label','Edit audio crossfade');marker.onclick=()=>{selected=clip.id;renderSelection();creative.open('transitions');};$('clips').append(marker);}
  const dissolve=transitionLength(project,clip);
  if(dissolve){const join=document.createElement('button');join.className='transition-marker';join.style.left=`${56+(entry.end-dissolve)/30*scale}px`;join.style.width=`${Math.max(24,dissolve/30*scale)}px`;join.textContent=TRANSITIONS.find(t=>t[0]===(clip.transition??'dissolve'))![1];join.title=`${join.textContent} · ${(dissolve/30).toFixed(2)} s`;join.setAttribute('aria-label','Edit transition');join.onclick=()=>{selected=clip.id;renderSelection();creative.open('transitions');};$('clips').append(join);}

 }
 for(const text of project.texts??[]){const node=document.createElement('button');node.className='text-clip';node.dataset.textId=text.id;node.style.left=`${56+text.startFrame/30*scale}px`;node.style.top=`${4+(text.kind==='title'?4:5)*52}px`;node.style.width=`${Math.max(30,text.frames/30*scale)}px`;node.textContent=text.text;node.title=`${text.kind}: ${text.text}`;node.disabled=busy;node.onclick=()=>{void preview.seek(text.startFrame);creative.open(text.kind==='title'?'title':'captions',text.id);};$('clips').append(node);}
 renderSelection();updateTime(Math.min(preview.frame,Math.max(0,total-1)));updateButtons();
}
function renderSelection(){
 document.querySelectorAll<HTMLElement>('.clip').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected));
 const c=current();const box=$('inspector');box.replaceChildren();
 if(!c){box.innerHTML='<div class="inspector-empty">Select a timeline clip to adjust its source range and volume.</div>';updateButtons();return;}
 const a=assetFor(c.assetId),heading=document.createElement('h3');heading.textContent=a.name;box.append(heading);
 const fields=document.createElement('div');fields.innerHTML=`<div class="property-caption">SOURCE RANGE · FRAMES AT 30 FPS</div><label>In frame<input id="trim-in" type="number" min="0" step="1" value="${c.inFrame}"></label><label>Out frame (exclusive)<input id="trim-out" type="number" min="1" step="1" value="${c.inFrame+c.frames}"></label><div class="range-actions"><button id="mark-in">In at playhead</button><button id="mark-out">Out at playhead</button></div><button id="apply-trim" class="wide">Apply trim</button><p class="note">${a.kind==='image'?'Still image · Extend or shorten using In/Out or the trim handles.':`Source length: ${sourceFrames(a)} frames.`} V1 trims close the gap. Other tracks keep their start time.</p><label class="volume-label">Volume <span id="volume-value">${Math.round(c.volume*100)}%</span><input id="volume" type="range" min="0" max="100" value="${Math.round(c.volume*100)}"></label><div class="range-actions"><button id="move-left">Move earlier</button><button id="move-right">Move later</button></div><button id="remove-clip" class="wide danger">Remove clip</button>`;box.append(fields);
 $('apply-trim').onclick=()=>{try{apply(trim(project,c.id,Number($<HTMLInputElement>('trim-in').value),Number($<HTMLInputElement>('trim-out').value)));}catch(e){error(e);}};
 const sourcePlayhead=()=>{const position=layersAt(project,preview.frame).find(e=>e.clip.id===c.id);if(!position)throw new Error('Move the playhead into the selected clip first.');return c.inFrame+position.offset;};
 $('mark-in').onclick=()=>{try{$<HTMLInputElement>('trim-in').value=String(sourcePlayhead());}catch(e){error(e);}};
 $('mark-out').onclick=()=>{try{$<HTMLInputElement>('trim-out').value=String(sourcePlayhead()+1);}catch(e){error(e);}};
 $('volume').oninput=()=>{$('volume-value').textContent=$<HTMLInputElement>('volume').value+'%';};
 $('volume').onchange=()=>{const p=clone(project);p.clips.find(x=>x.id===c.id)!.volume=Number($<HTMLInputElement>('volume').value)/100;apply(p);};
 $('move-left').onclick=()=>move(-1);$('move-right').onclick=()=>move(1);$('remove-clip').onclick=remove;
 renderTrackSettings(box,c.id);box.append(fields);
 if(busy)for(const el of box.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button,select'))el.disabled=true;
 updateButtons();
}
function trackName(track:Track){return ({v1:'V1 · Main video',v2:'V2 · Overlay video',a1:'A1 · Audio',a2:'A2 · Audio'})[track];}
function renderTrackSettings(box:HTMLElement,id:string){
 const clip=project.clips.find(c=>c.id===id)!,entry=placements(project).find(e=>e.clip.id===id)!;
 const group=document.createElement('div');group.className='track-settings';
 group.innerHTML=`<div class="property-caption">TRACK & TIMING</div><label>Track<select id="clip-track">${TRACKS.map(t=>`<option value="${t}">${trackName(t)}</option>`).join('')}</select></label><label>Timeline start (seconds)<input id="clip-start" type="number" min="0" step="0.033333" value="${(entry.start/30).toFixed(3)}"></label><button id="apply-placement" class="wide">Apply placement</button>`;
 box.append(group);$<HTMLSelectElement>('clip-track').value=entry.track;
 const updateStart=()=>{$<HTMLInputElement>('clip-start').disabled=busy||$<HTMLSelectElement>('clip-track').value==='v1';};updateStart();$('clip-track').onchange=updateStart;
 $('apply-placement').onclick=()=>{try{
  const p=disconnectAudioJoins(project,id),c=p.clips.find(c=>c.id===id)!,track=$<HTMLSelectElement>('clip-track').value as Track,start=Number($<HTMLInputElement>('clip-start').value);
  if(!Number.isFinite(start)||start<0||start>86400)throw new Error('Set a timeline start within 24 hours.');
  c.track=track;if(track==='v1'){delete c.startFrame;}else{c.startFrame=Math.round(start*30);delete c.transitionFrames;delete c.transition;}
  apply(p,id);
 }catch(e){error(e);}};
 if(entry.track==='v1'){const button=document.createElement('button');button.id='clip-transition-button';button.className='wide';button.textContent='Transition to next clip…';button.onclick=()=>creative.open('transitions');box.append(button);}
 if((entry.track==='v1'||entry.track==='v2')&&assetFor(clip.assetId).kind!=='audio'){
  const controls=document.createElement('div');controls.innerHTML='<div class="property-caption">PICTURE</div>';
  for(const [key,label,min,max,value] of [['scale','Scale (%)',10,200,(clip.scale??1)*100],['x','Horizontal centre (%)',0,100,(clip.x??.5)*100],['y','Vertical centre (%)',0,100,(clip.y??.5)*100],['opacity','Opacity (%)',0,100,(clip.opacity??1)*100]] as const){
   const field=document.createElement('label');field.textContent=label;const input=document.createElement('input');input.type='number';input.id=`picture-${key}`;input.min=String(min);input.max=String(max);input.step='1';input.value=String(Math.round(value));field.append(input);controls.append(field);
   input.onchange=()=>{const number=Number(input.value);if(!Number.isFinite(number)||number<min||number>max){error(`Set ${label} between ${min} and ${max}.`);return;}const p=clone(project);p.clips.find(c=>c.id===id)![key]=number/100;apply(p,id);};
  }
  box.append(controls);
 }
}
function move(delta:number){
 const c=current();if(!c)return;
 if(trackOf(c)!=='v1'){const p=disconnectAudioJoins(project,selected),clip=p.clips.find(x=>x.id===selected)!;clip.startFrame=Math.max(0,(clip.startFrame??0)+delta*30);try{apply(p);}catch(e){error(e);}return;}
 const main=project.clips.filter(c=>trackOf(c)==='v1'),i=main.findIndex(c=>c.id===selected),other=main[i+delta];if(!other)return;
 const p=clone(project),from=p.clips.findIndex(c=>c.id===selected),to=p.clips.findIndex(c=>c.id===other.id);[p.clips[from],p.clips[to]]=[p.clips[to],p.clips[from]];apply(p);
}
function remove(){if(busy||!current())return;const p=disconnectAudioJoins(project,selected);p.clips=p.clips.filter(c=>c.id!==selected);apply(p,'');}
function setBusy(value:boolean){busy=value;$<HTMLInputElement>('project-name').disabled=value;$<HTMLInputElement>('scrub').disabled=value;render();}
function confirmDiscard(){return !dirty||confirm('Unsaved changes will be replaced. Save your project first if you need to keep them. Continue?');}
function resetTo(p:Project){importNotice='';importFailed=false;recentImports.clear();clearTimeout(autosaveTimer);project=p;selected='';history.clear();saved=JSON.stringify(project);dirty=false;preview.setProject(project,files);render();void preview.seek(0);$('save-state').textContent='Project opened';queueAutosave();}
function collectUnused(){for(const [id,local] of files){if(!project.assets.some(a=>a.id===id)){URL.revokeObjectURL(local.url);files.delete(id);}}}

$('new').onclick=()=>{if(confirmDiscard()){resetTo(fresh());collectUnused();say('New sequence.');}};
$('open').onclick=()=>$<HTMLInputElement>('project-file').click();
$('save').onclick=async()=>{
 if(busy)return;preview.pause();setBusy(true);
 try{const snapshot=JSON.stringify(project);const outcome=await download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${project.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'Ordo'}.ordo`);
  if(outcome==='cancelled'){say('Save cancelled. Your edit remains open.');return;}saved=snapshot;markDirty();say(outcome==='saved'?'Project saved. Keep your original media for reopening.':'Project download requested. Keep your original media for reopening.');
 }catch(e){error(e);}finally{setBusy(false);}
};
$('import').onclick=()=>{if(busy)return;if(isAndroid)void chooseNative(false);else $<HTMLInputElement>('media-file').click();};
$('import-empty').onclick=()=>{if(busy)return;if(project.assets.length||importFailed)showMedia();else $('import').click();};
function showMedia(){
 if(document.body.classList.contains('mobile-ui'))mobile.showSheet('media');
 else{const panel=document.querySelector<HTMLElement>('.media-panel')!;panel.scrollIntoView({block:'nearest'});panel.querySelector<HTMLElement>('button:not(:disabled)')?.focus();}
}
$('undo').onclick=()=>{if(busy)return;project=history.undo(project);selected=project.clips.some(c=>c.id===selected)?selected:'';markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();};
$('redo').onclick=()=>{if(busy)return;project=history.redo(project);markDirty();preview.setProject(project,files);render();void preview.seek(preview.frame);queueAutosave();};
$('split').onclick=()=>{try{if(!busy)apply(split(project,selected,preview.frame,crypto.randomUUID()));}catch(e){error(e);}};
$('delete').onclick=remove;
$('duplicate').onclick=()=>{if(busy)return;const index=project.clips.findIndex(c=>c.id===selected);if(index<0)return;const p=clone(project),id=crypto.randomUUID();const copy={...p.clips[index],id};delete copy.audioCrossfadeFrames;if(trackOf(copy)!=='v1')copy.startFrame=placements(project).find(e=>e.clip.id===selected)!.end;p.clips.splice(index+1,0,copy);try{apply(p,id);}catch(e){error(e);}};
$('add-all-media').onclick=()=>{
 if(busy)return;
 const ids=project.assets.filter(a=>files.has(a.id)).map(a=>a.id);if(!ids.length)return;
 try{const p=appendMedia(project,ids,$<HTMLSelectElement>('bulk-video').value as 'v1'|'v2',$<HTMLSelectElement>('bulk-audio').value as 'a1'|'a2',preview.frame,()=>crypto.randomUUID());apply(p,p.clips.at(-1)!.id);const skipped=project.assets.length-ids.length;say(`Added ${ids.length} media files.${skipped?` ${skipped} missing files skipped; relink them to add.`:''}`);}catch(e){error(e);}
};
function compareOriginal(value:boolean){preview.setBypassAdjustments(value);$<HTMLInputElement>('compare-adjustments').checked=!value;}
$('compare-adjustments').onchange=()=>compareOriginal(!$<HTMLInputElement>('compare-adjustments').checked);
$('play').onclick=()=>{if(!busy)void preview.toggle();};$('previous').onclick=()=>{if(!busy)void preview.seek(preview.frame-1);};$('next').onclick=()=>{if(!busy)void preview.seek(preview.frame+1);};
$('scrub').oninput=()=>{if(!busy)void preview.seek(Number($<HTMLInputElement>('scrub').value));};
$('ruler').onclick=e=>{if(busy)return;const x=e.clientX-$('timeline-content').getBoundingClientRect().left-56;void preview.seek(x/scale*30);};
$('zoom').oninput=()=>{scale=Number($<HTMLInputElement>('zoom').value);render();};
$('fit').onclick=()=>{scale=Math.max(12,Math.min(120,($('timeline-scroll').clientWidth-100)/Math.max(1,duration(project)/30)));$<HTMLInputElement>('zoom').value=String(scale);render();};
$('project-name').onchange=()=>{const p=clone(project);p.name=$<HTMLInputElement>('project-name').value.trim()||'Untitled sequence';apply(p);};
$('fullscreen').onclick=()=>{void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(error);};
$('help').onclick=()=>$<HTMLDialogElement>('help-dialog').showModal();$('close-help').onclick=()=>$<HTMLDialogElement>('help-dialog').close();

async function importChosen(chosen:(File|NativeMedia)[],relinkOnly=false,targetId=''){
 if(!chosen.length||busy)return;
 preview.pause();importing=true;importFailed=false;recentImports.clear();importNotice=`Reading ${chosen.length} files…`;setBusy(true);showMedia();
 const p=clone(project);let added=0,duplicates=0,relinked=0,unremembered=0;const failures:string[]=[];
 for(const [index,choice] of chosen.entries()){
  importNotice=`Reading ${index+1} of ${chosen.length}: ${choice.name}`;render();say(importNotice);
  try{
   const native=choice instanceof File?undefined:choice,file=choice instanceof File?choice:await nativeFile(choice);
   const a=await inspect(file);a.sha256=await fileHash(file);
   const missing=p.assets.filter(a=>!files.has(a.id));
   const target=targetId&&chosen.length===1?missing.find(a=>a.id===targetId):undefined;
   if(target&&!sameSource(target,a))throw new Error('This file does not match the original media.');
   const matches=target?[target]:relinkCandidates(missing,a);
   if(matches.length){
    for(const original of matches){original.sha256=a.sha256;files.set(original.id,{file,url:URL.createObjectURL(file)});recentImports.add(original.id);relinked++;}
    try{await rememberMedia(matches[0],file,native);}catch{unremembered++;}
   }else if(relinkOnly)throw new Error('No unique matching missing asset. Use Relink on its media card for older projects.');
   else if(p.assets.some(asset=>asset.sha256===a.sha256&&files.has(asset.id))){duplicates++;try{await rememberMedia(p.assets.find(asset=>asset.sha256===a.sha256)!,file,native);}catch{unremembered++;}}
   else{p.assets.push(a);files.set(a.id,{file,url:URL.createObjectURL(file)});recentImports.add(a.id);added++;try{await rememberMedia(a,file,native);}catch{unremembered++;}}
  }catch(e){failures.push(`${choice.name}: ${e instanceof Error?e.message:String(e)}`);}
 }
 importing=false;importFailed=failures.length>0;
 importNotice=[added?`${added} ${added===1?'file imported':'files imported'}. Tap Add to sequence to start editing.`:'',relinked?`${relinked} media ${relinked===1?'asset':'assets'} relinked.`:'',duplicates?`${duplicates} ${duplicates===1?'file is':'files are'} already in Project media.`:'',unremembered?`${unremembered} files are available for this session only; local storage could not remember them.`:'',...failures].filter(Boolean).join(' ');
 setBusy(false);if(JSON.stringify(p)!==JSON.stringify(project))apply(p);else{preview.setProject(project,files);render();void preview.seek(preview.frame);}say(importNotice);
 const newest=document.querySelector<HTMLElement>('.media-card.just-imported');if(newest)$('media-list').scrollTop=newest.offsetTop-$('media-list').offsetTop;
}
async function chooseNative(relinkOnly:boolean,target=''){
 if(busy)return;setBusy(true);let chosen:NativeMedia[]=[];
 try{chosen=await pickNativeMedia(remembersMedia());}catch(e){error(e);}finally{setBusy(false);}
 await importChosen(chosen,relinkOnly,target);
}
$('remember-media').onchange=()=>{try{setRemembersMedia($<HTMLInputElement>('remember-media').checked);}catch(e){error(e);}};
$('forget-media').onclick=async()=>{if(busy||!confirm('Forget remembered media on this device? Files in the current edit stay open. Reopening will need relinking.'))return;try{setBusy(true);await forgetMedia();say('Remembered media forgotten. Current editing files remain available.');}catch(e){error(e);}finally{setBusy(false);}};
$('locate-media').onclick=()=>{if(busy)return;if(isAndroid)void chooseNative(true);else $<HTMLInputElement>('locate-files').click();};
$<HTMLInputElement>('media-file').onchange=()=>{const input=$<HTMLInputElement>('media-file'),chosen=Array.from(input.files??[]);input.value='';void importChosen(chosen);};
$<HTMLInputElement>('locate-files').onchange=()=>{const input=$<HTMLInputElement>('locate-files'),chosen=Array.from(input.files??[]);input.value='';void importChosen(chosen,true);};
$<HTMLInputElement>('relink-file').onchange=()=>{const input=$<HTMLInputElement>('relink-file'),chosen=Array.from(input.files??[]);input.value='';void importChosen(chosen,true,relinkId);};
async function openProject(p:Project){
 preview.pause();setBusy(true);say('Reconnecting remembered media…');
 try{
  const known=project.assets.map(a=>({a,local:files.get(a.id)})),matched=new Map<string,LocalMedia>();
  for(const a of p.assets){const old=known.find(k=>k.local&&sameSource(a,k.a));let file=old?.local?.file;if(!file)file=await restoreMedia(a);if(file){if(!a.sha256)a.sha256=old?.a.sha256??await fileHash(file);matched.set(a.id,{file,url:URL.createObjectURL(file)});}}
  for(const local of files.values())URL.revokeObjectURL(local.url);files.clear();for(const [id,local] of matched)files.set(id,local);resetTo(p);
  const missing=p.assets.length-matched.size;importNotice=`${matched.size} media ${matched.size===1?'asset':'assets'} automatically reconnected.${missing?' '+missing+' missing. Use Locate missing media.':''}`;render();say('Project opened. '+importNotice);
 }finally{setBusy(false);}
}
$<HTMLInputElement>('project-file').onchange=async()=>{const input=$<HTMLInputElement>('project-file'),file=input.files?.[0];input.value='';if(!file||busy)return;try{if(file.size>5_000_000)throw new Error('Project files must be smaller than 5 MB.');const p=parseProject(await file.text());if(confirmDiscard())await openProject(p);}catch(e){error(e);}};
function exportSettings():ExportSettings{return{resolution:Number($<HTMLSelectElement>("export-resolution").value),fps:Number($<HTMLSelectElement>("export-fps").value),quality:$<HTMLSelectElement>("export-quality").value as ExportSettings["quality"]};}
async function checkFormat(){
 const serial=++checkSerial,format=$<HTMLSelectElement>('format').value as Format;
 $('format-status').textContent='Checking export engines…';$<HTMLButtonElement>('start-export').disabled=true;
 // Every source may contain audio, so preflight conservatively checks both codecs.
 const settings=exportSettings(),dimensions=exportDimensions(project,settings),reason=nativeReason(project,files,format),nativeReady=reason===null;$("export-description").textContent=`${dimensions.width} × ${dimensions.height} · ${dimensions.fps} fps · ${(dimensions.bitrate/1_000_000).toFixed(1)} Mbps · Est. ${Math.ceil((dimensions.bitrate+128000)*duration(project)/30/8/1_000_000)} MB`;const ok=nativeReady||await supported(format,project.clips.some(c=>c.volume>0&&assetFor(c.assetId).kind!=='image'),settings,project);if(serial!==checkSerial)return;
 $('format-status').textContent=nativeReady?'Native Android export selected. Device codec support will be checked during rendering.':ok?`${isAndroid?reason+' ':''}${EXPORT_FORMATS[format].label} encoder checks passed. Source decoding will be checked during export.`:`${EXPORT_FORMATS[format].label} encoding is unavailable at these settings on this device. Choose H.264 or WebM, or lower the resolution / FPS.`;
 $<HTMLButtonElement>('start-export').disabled=!ok||busy||!duration(project);
}
$('export').onclick=()=>{preview.pause();$<HTMLProgressElement>('export-progress').value=0;$<HTMLDialogElement>('export-dialog').showModal();void checkFormat();};
for(const id of ['format','export-resolution','export-fps','export-quality'])$(id).onchange=()=>void checkFormat();
$('close-export').onclick=()=>{if(!controller)$<HTMLDialogElement>('export-dialog').close();};
$('export-dialog').addEventListener('cancel',e=>{if(controller)e.preventDefault();});
$('cancel-export').onclick=()=>{controller?.abort();$('format-status').textContent='Cancelling…';};
$('start-export').onclick=async()=>{
 if(busy)return;const format=$<HTMLSelectElement>('format').value as Format,settings=exportSettings(),dimensions=exportDimensions(project,settings);if(isAndroid&&nativeReason(project,files,format)!==null&&(dimensions.bitrate+128000)*duration(project)/30/8>250_000_000){$('format-status').textContent='Estimated file size exceeds the Android save limit. Choose a lower resolution or quality, or shorten the edit.';return;}preview.releaseMedia();controller=new AbortController();setBusy(true);void keepAwake(true).catch(()=>{});
 $<HTMLButtonElement>('start-export').disabled=true;$<HTMLButtonElement>('cancel-export').disabled=false;for(const id of ['format','export-resolution','export-fps','export-quality'])$<HTMLSelectElement>(id).disabled=true;$<HTMLButtonElement>('close-export').disabled=true;
 try{
  const snapshot=clone(project),name=`${project.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'Ordo'}.${EXPORT_FORMATS[format].extension}`;
  const update=(n:number,phase:string)=>{$<HTMLProgressElement>('export-progress').value=n;$('format-status').textContent=`${phase} · ${Math.round(n*100)}%`;};
  let outcome:'saved'|'cancelled'|'requested'|undefined;
  if(nativeReason(snapshot,files,format)===null){
   try{outcome=await exportNative(snapshot,files,format,settings,name,controller.signal,update);}
   catch(e){if(controller.signal.aborted||e instanceof NativeSaveError)throw e;say(`Native export unavailable: ${e instanceof Error?e.message:String(e)} Retrying with compatible exporter.`);update(0,'Retrying with compatible exporter');}
  }
  if(!outcome){if(isAndroid&&(dimensions.bitrate+128000)*duration(snapshot)/30/8>250_000_000)throw new Error('Native export could not complete, and the estimated file exceeds the compatible Android save limit. Choose a lower resolution or quality, then export again.');const blob=await exportSequence(snapshot,files,format,controller.signal,update,settings);$('format-status').textContent=isAndroid?'Render complete. Choose where to save your video…':'Render complete. Preparing download…';outcome=await download(blob,name);}
  $('format-status').textContent=outcome==='saved'?'Video saved to your chosen location.':outcome==='cancelled'?'Saving cancelled. Export again to save a copy.':'Export complete. Download requested.';say($('format-status').textContent!);}
 catch(e){$('format-status').textContent=e instanceof Error?e.message:String(e);error(e);}
 finally{controller=null;void preview.seek(preview.frame);void keepAwake(false).catch(()=>{});setBusy(false);$<HTMLButtonElement>('cancel-export').disabled=true;for(const id of ['format','export-resolution','export-fps','export-quality'])$<HTMLSelectElement>(id).disabled=false;$<HTMLButtonElement>('close-export').disabled=false;$<HTMLButtonElement>('start-export').disabled=false;}
};
$('recover').onclick=async()=>{if(!busy&&recovery&&confirmDiscard()){try{await openProject(clone(recovery));saved='';markDirty();$('recover').hidden=true;}catch(e){error(e);}}};
void dbPromise.then(async db=>{const text=await db.get('recovery','latest');if(text){try{recovery=parseProject(text);$('recover').hidden=false;}catch{say('An older recovery snapshot could not be opened.');}}}).catch(()=>say('Local recovery storage unavailable. Save project files regularly.'));
window.addEventListener('beforeunload',event=>{if(dirty||controller){event.preventDefault();event.returnValue='';}});
window.addEventListener('keydown',event=>{
 const target=event.target as HTMLElement;if(document.body.classList.contains('sheet-visible'))return;
 if(busy||target.matches('input,textarea,select')||target.isContentEditable||document.querySelector('dialog[open]'))return;
 if(document.body.classList.contains('preview-expanded')&&!['Space','ArrowLeft','ArrowRight'].includes(event.code))return;
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
const fullscreenPreview=setupPreviewFullscreen({beforeEnter:()=>mobile.closeSheet(),report:say});
const creative=setupCreative({project:()=>project,selected:current,frame:()=>preview.frame,busy:()=>busy,commit:p=>apply(p),draft:(p,live)=>{const draft=parseProject(JSON.stringify(p));$('preview-empty').hidden=!!duration(draft);$('program-settings').textContent=`${draft.width} × ${draft.height} · 30 fps`;preview.setDraft(draft,live);},restore:(live)=>{compareOriginal(false);$('preview-empty').hidden=!!duration(project);$('program-settings').textContent=`${project.width} × ${project.height} · 30 fps`;preview.setDraft(project,live);},media:id=>files.get(id),beforeOpen:live=>{mobile.closeSheet();if(!live)preview.pause();}});
for(const kind of ['transitions','title','captions','adjust','crop'])$('tool-'+kind).onclick=()=>{if(!document.querySelector('.creative-dialog[open]'))creative.open(kind);};
if(isAndroid){document.body.classList.add('android-app');$('fullscreen').hidden=true;}
document.addEventListener('visibilitychange',()=>{if(document.hidden)preview.pause();});
window.addEventListener('ordo-back',()=>{
 if(fullscreenPreview.active()){void fullscreenPreview.exit();return;}
 const dialog=document.querySelector<HTMLDialogElement>('dialog[open]');
 if(dialog){if(controller){if(confirm('Cancel the export?'))controller.abort();}else dialog.close();return;}
 if(mobile.closeSheet())return;
 if(busy){say('Please finish the current operation first.');return;}
 if(!dirty||confirm('Exit Ordo? Save your project first to keep a portable copy of your edits.'))void exitAndroid();
});
