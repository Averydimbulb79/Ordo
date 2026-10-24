import {layersAt,placements} from './model';
import type {Project} from './model';
import type {AudioBufferSink} from 'mediabunny';
import {createAudioChain} from './audio-engine';

/** Keep one processing graph for the entire render so EQ/compressor state survives
 * each source decoding window. Only the final stereo mix is retained in full. */
export async function renderAudioMix(project:Project,sinks:Map<string,AudioBufferSink>,frames:number,fps:number,signal:AbortSignal,progress:(n:number)=>void){
 const rate=48000,seconds=frames/fps,context=new OfflineAudioContext(2,frames*(rate/fps),rate),entries=placements(project);
 const chains=new Map<string,ReturnType<typeof createAudioChain>>();
 const inputs=new Map<string,GainNode>();
 const check=()=>{if(signal.aborted)throw new DOMException('Export cancelled','AbortError');};
 let rendering:Promise<AudioBuffer>|undefined;
 try{
  const windowSeconds=4;
  for(let block=0;block<Math.ceil(seconds/windowSeconds);block++){
   check();const left=block*windowSeconds,right=Math.min(seconds,left+windowSeconds);
   for(const entry of entries){
    const c=entry.clip,sink=sinks.get(c.assetId),a=Math.max(left,entry.start/30),b=Math.min(right,entry.end/30);
    if(!sink||!c.volume||b<=a)continue;
    let chain=chains.get(c.id),input=inputs.get(c.id);
    if(!chain){input=context.createGain();inputs.set(c.id,input);chain=createAudioChain(context,input,context.destination);chain.update(c.audio);chains.set(c.id,chain);}
    const sourceIn=c.inFrame/30+a-entry.start/30,sourceOut=c.inFrame/30+b-entry.start/30;
    for await(const packet of sink.buffers(sourceIn,sourceOut)){
     check();const from=Math.max(sourceIn,packet.timestamp),to=Math.min(sourceOut,packet.timestamp+packet.buffer.duration);
     if(to>from){const node=context.createBufferSource();node.buffer=packet.buffer;node.connect(input!);node.onended=()=>node.disconnect();node.start(a+from-sourceIn,from-packet.timestamp,to-from);}
    }
    const start=Math.ceil(a*fps-1e-8),end=Math.ceil(b*fps-1e-8);
    for(let f=start;f<=end;f++){
     const time=Math.min(b,f/fps),sample=Math.min(entry.end-1e-7,time*30);
     const weight=layersAt(project,sample).find(e=>e.clip.id===c.id)?.audioWeight??0;
     const value=c.volume*weight;
     if(f===start)chain.level.gain.setValueAtTime(value,time);else chain.level.gain.linearRampToValueAtTime(value,time);
    }
    if(b===entry.end/30)chain.level.gain.setValueAtTime(0,b);
   }
   // Suspend at each bounded decoding window before fetching the next source window.
   const next=right<seconds?context.suspend(right):null;
   if(!rendering){rendering=context.startRendering();void rendering.catch(()=>{});}else await context.resume();
   if(next)await next;
   progress(right/seconds);
  }
  const result=await rendering!;check();return result;
 }catch(error){if(context.state==='suspended')void context.resume().catch(()=>{});throw error;}
 finally{if(context.state==='closed')for(const chain of chains.values())chain.dispose();}
}
