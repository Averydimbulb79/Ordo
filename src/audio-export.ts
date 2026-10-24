import {pitchPreservedAudio} from './speed-audio';
import type {RetimedPacket} from './speed-audio';
import {layersAt,placements,playbackSpeed,sourceSpan} from './model';
import type {Project} from './model';
import type {AudioBufferSink} from 'mediabunny';
import {createAudioChain} from './audio-engine';

/** Keep one processing graph for the entire render so EQ/compressor state survives
 * each source decoding window. Only the final stereo mix is retained in full. */
export async function renderAudioMix(project:Project,sinks:Map<string,AudioBufferSink>,frames:number,fps:number,signal:AbortSignal,progress:(n:number)=>void){
 const rate=48000,seconds=frames/fps,context=new OfflineAudioContext(2,frames*(rate/fps),rate),entries=placements(project);
 const chains=new Map<string,ReturnType<typeof createAudioChain>>();
 const stretches=new Map<string,{iterator:AsyncGenerator<RetimedPacket>;pending?:RetimedPacket;done?:boolean}>();
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
    const speed=playbackSpeed(c);
    if(speed!==1&&c.preservePitch!==false){
     let state=stretches.get(c.id);if(!state){state={iterator:pitchPreservedAudio(c,sink,signal)};stretches.set(c.id,state);}
     while(!state.done){
      check();if(!state.pending){const next=await state.iterator.next();if(next.done){state.done=true;break;}state.pending=next.value;}
      const packet=state.pending,stamp=entry.start/30+packet.timestamp,packetEnd=stamp+packet.buffer.duration;
      if(stamp>=b)break;
      const from=Math.max(a,stamp),to=Math.min(b,packetEnd);
      if(to>from){const node=context.createBufferSource();node.buffer=packet.buffer;node.connect(input!);node.onended=()=>node.disconnect();node.start(from,from-stamp,to-from);}
      if(packetEnd>b+1e-9)break;state.pending=undefined;
     }
    }else{
     const sourceIn=c.inFrame/30+(a-entry.start/30)*speed,sourceOut=Math.min((c.inFrame+sourceSpan(c))/30,c.inFrame/30+(b-entry.start/30)*speed);
     for await(const packet of sink.buffers(sourceIn,sourceOut)){
      check();const from=Math.max(sourceIn,packet.timestamp),to=Math.min(sourceOut,packet.timestamp+packet.buffer.duration);
      if(to>from){const node=context.createBufferSource();node.buffer=packet.buffer;node.playbackRate.value=speed;node.connect(input!);node.onended=()=>node.disconnect();node.start(a+(from-sourceIn)/speed,from-packet.timestamp,to-from);}
     }
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
 finally{for(const state of stretches.values())await state.iterator.return(undefined).catch(()=>{});if(context.state==='closed')for(const chain of chains.values())chain.dispose();}
}
