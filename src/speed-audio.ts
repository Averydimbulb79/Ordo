import {createSignalsmithStretch} from 'signalsmith-stretch-js';
import type {AudioBufferSink} from 'mediabunny';
import {playbackSpeed,sourceSpan} from './model';
import type {Clip} from './model';
export type RetimedPacket={buffer:AudioBuffer;timestamp:number};
/** Stream bounded PCM blocks through one stateful stretcher, compensating its latency once. */
export async function* pitchPreservedAudio(clip:Clip,sink:AudioBufferSink,signal:AbortSignal):AsyncGenerator<RetimedPacket>{
 const check=()=>{if(signal.aborted)throw new DOMException('Export cancelled','AbortError');};
 check();const engine=await createSignalsmithStretch({wasmUrl:new URL('vendor/signalsmith-stretch-wasm.wasm',document.baseURI)});
 let stream:Awaited<ReturnType<typeof engine.createStreamProcessor>>|undefined;
 let rate=0,skip=0,emitted=0,consumed=0,target=0,sourceTarget=0;
 const start=clip.inFrame/30,end=(clip.inFrame+sourceSpan(clip))/30;
 const output=(channels:Float32Array[]):RetimedPacket|undefined=>{
  const remove=Math.min(skip,channels[0].length);skip-=remove;const count=Math.min(channels[0].length-remove,target-emitted);if(count<=0)return;
  const buffer=new AudioBuffer({numberOfChannels:2,length:count,sampleRate:rate});for(let c=0;c<2;c++)buffer.copyToChannel(new Float32Array(channels[c].subarray(remove,remove+count)),c);
  const timestamp=emitted/rate;emitted+=count;return{buffer,timestamp};
 };
 try{
  for await(const packet of sink.buffers(start,end)){
   check();if(!stream){rate=packet.buffer.sampleRate;sourceTarget=Math.round((end-start)*rate);target=Math.round(sourceTarget/playbackSpeed(clip));stream=await engine.createStreamProcessor({sampleRate:rate,channels:2,timeRatio:1/playbackSpeed(clip),pitchScale:1,maxBlockSize:4096});skip=stream.latencyFrames;}
   if(packet.buffer.sampleRate!==rate)throw new Error('Audio sample rate changed inside the clip.');
   const from=Math.max(start,packet.timestamp),to=Math.min(end,packet.timestamp+packet.buffer.duration);if(to<=from)continue;
   const packetStart=Math.max(0,Math.round((from-start)*rate)),offset=Math.max(0,Math.round((from-packet.timestamp)*rate)),length=Math.min(packet.buffer.length-offset,Math.round((to-from)*rate));
   // Fill decoder timestamp gaps with silence, then consume each source sample only once.
   while(consumed<packetStart){check();const count=Math.min(4096,packetStart-consumed);const result=output(stream.process([new Float32Array(count),new Float32Array(count)]));consumed+=count;if(result)yield result;}
   let at=Math.max(0,consumed-packetStart);
   while(at<length&&consumed<sourceTarget){check();const count=Math.min(4096,length-at,sourceTarget-consumed);const channels=[0,1].map(c=>packet.buffer.getChannelData(Math.min(c,packet.buffer.numberOfChannels-1)).subarray(offset+at,offset+at+count));const result=output(stream.process(channels));at+=count;consumed+=count;if(result)yield result;}
  }
  if(stream){while(consumed<sourceTarget){check();const count=Math.min(4096,sourceTarget-consumed);const result=output(stream.process([new Float32Array(count),new Float32Array(count)]));consumed+=count;if(result)yield result;}const tail=output(stream.flush());if(tail)yield tail;}
 }finally{stream?.dispose();engine.dispose();}
}
