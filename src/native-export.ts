import { Capacitor,registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { ALL_FORMATS,AudioBufferSink,BlobSource,Input } from 'mediabunny';
import type { Project } from './model';
import { placements,duration } from './model';
import type { LocalMedia } from './media';
import { isAndroid,nativeUriFor } from './native';
import { nativeExportReason } from './native-plan';
import { exportDimensions } from './export-settings';
import type { ExportSettings } from './export-settings';
import type { Format } from './export-formats';
import { renderAudioMix } from './audio-export';
interface NativeExporter {
 prepare():Promise<{token:string}>;
 appendAudio(options:{token:string;data:string;offset:number}):Promise<void>;
 render(options:{token:string;clips:unknown[];width:number;height:number;fps:number;bitrate:number;hevc:boolean}):Promise<void>;
 save(options:{token:string;name:string}):Promise<{cancelled:boolean}>;
 discard(options:{token:string}):Promise<void>;
 addListener(event:'progress',listener:(event:{token:string;progress:number})=>void):Promise<PluginListenerHandle>;
}
export class NativeSaveError extends Error {}
const engine=registerPlugin<NativeExporter>('OrdoExport');
export function nativeReason(project:Project,files:Map<string,LocalMedia>,format:Format){
 if(!isAndroid||!Capacitor.isPluginAvailable('OrdoExport'))return 'Native export is unavailable in this app build.';
 return nativeExportReason(project,format,id=>{const local=files.get(id);return !!local&&!!nativeUriFor(local.file);});
}
function wavHeader(samples:number){
 const bytes=new Uint8Array(44),view=new DataView(bytes.buffer),str=(p:number,s:string)=>{for(let i=0;i<s.length;i++)bytes[p+i]=s.charCodeAt(i);};
 str(0,'RIFF');view.setUint32(4,36+samples*4,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples*4,true);return bytes;
}
export async function exportNative(project:Project,files:Map<string,LocalMedia>,format:Format,settings:ExportSettings,name:string,signal:AbortSignal,progress:(n:number,phase:string)=>void):Promise<'saved'|'cancelled'>{
 const reason=nativeReason(project,files,format);if(reason)throw new Error(reason);
 const check=()=>{if(signal.aborted)throw new DOMException('Export cancelled','AbortError');};check();
 const {token}=await engine.prepare();let listener:PluginListenerHandle|undefined;
 const abort=()=>{void engine.discard({token}).catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 const inputs:Input[]=[];
 try{
  check();const options=exportDimensions(project,settings),frames=Math.ceil(duration(project)/30*options.fps),sinks=new Map<string,AudioBufferSink>(),checkedAssets=new Set<string>();
  for(const c of project.clips){
   check();if(!c.volume||checkedAssets.has(c.assetId)||project.assets.find(a=>a.id===c.assetId)?.kind==='image')continue;
   checkedAssets.add(c.assetId);const file=files.get(c.assetId)?.file;if(!file)throw new Error('Relink all timeline media before exporting.');
   const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});inputs.push(input);const track=await input.getPrimaryAudioTrack();
   if(track){if(!await track.canDecode())throw new Error(`Audio decoder unavailable for ${file.name}.`);sinks.set(c.assetId,new AudioBufferSink(track));}
  }
  // Use the same offline audio graph as compatible export: EQ, fades, compressor,
  // pan and overlapping tracks remain identical while native video avoids WebView seeking.
  if(sinks.size){
   const audio=await renderAudioMix(project,sinks,frames,options.fps,signal,n=>progress(n*.15,'Mixing audio'));
   const channels=[audio.getChannelData(0),audio.getChannelData(1)];let offset=0;
   const append=async(bytes:Uint8Array)=>{check();let binary='';for(let p=0;p<bytes.length;p+=8192)binary+=String.fromCharCode(...bytes.subarray(p,p+8192));await engine.appendAudio({token,data:btoa(binary),offset});offset+=bytes.length;};
   if(audio.length*4+44>0xffffffff)throw new Error('Native audio exceeds the WAV size limit.');
   await append(wavHeader(audio.length));
   for(let start=0;start<audio.length;start+=48000){
    const count=Math.min(48000,audio.length-start),bytes=new Uint8Array(count*4),view=new DataView(bytes.buffer);
    for(let i=0;i<count;i++)for(let c=0;c<2;c++){const value=Math.max(-1,Math.min(1,channels[c][start+i]));view.setInt16(i*4+c*2,Math.round(value*(value<0?32768:32767)),true);}
    await append(bytes);progress(.15+.05*(start+count)/audio.length,'Preparing native audio');
   }
  }
  check();listener=await engine.addListener('progress',event=>{if(event.token===token)progress(.2+.8*event.progress,'Native Android rendering');});
  const clips=placements(project).filter(e=>e.track==='v1').map(({clip})=>({...clip,uri:nativeUriFor(files.get(clip.assetId)!.file),kind:project.assets.find(a=>a.id===clip.assetId)!.kind}));
  progress(.2,'Native Android rendering');await engine.render({token,clips,...options,hevc:format==='mp4-hevc'});check();
  progress(1,'Render complete. Choose where to save your video…');
  try{const result=await engine.save({token,name});return result.cancelled?'cancelled':'saved';}
  catch(e){throw new NativeSaveError(`Native video rendered, but saving failed: ${e instanceof Error?e.message:String(e)}`);}
 }finally{
  signal.removeEventListener('abort',abort);await listener?.remove();for(const input of inputs)input.dispose();await engine.discard({token}).catch(()=>{});
 }
}
