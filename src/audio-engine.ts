import type { AudioSettings } from './audio-model';
export function createAudioChain(context:BaseAudioContext,source:AudioNode,destination:AudioNode){
 const gain=context.createGain(),bass=context.createBiquadFilter(),mid=context.createBiquadFilter(),treble=context.createBiquadFilter(),compressor=context.createDynamicsCompressor(),limiter=context.createDynamicsCompressor(),pan=context.createStereoPanner(),level=context.createGain();
 bass.type='lowshelf';bass.frequency.value=250;mid.type='peaking';mid.frequency.value=1000;mid.Q.value=.8;treble.type='highshelf';treble.frequency.value=4000;level.gain.value=0;
 const nodes=[source,gain,bass,mid,treble,pan,compressor,limiter,level];for(let i=0;i<nodes.length-1;i++)nodes[i].connect(nodes[i+1]);level.connect(destination);
 let signature='';
 return {level,update(audio:AudioSettings={},bypass=false){
  const key=JSON.stringify([audio,bypass]);if(key===signature)return;signature=key;
  const a=bypass?{}:audio,t=context.currentTime;
  gain.gain.setValueAtTime(10**((a.gainDb??0)/20),t);bass.gain.setValueAtTime(a.bass??0,t);mid.gain.setValueAtTime(a.mid??0,t);treble.gain.setValueAtTime(a.treble??0,t);pan.pan.setValueAtTime(a.pan??0,t);
  compressor.threshold.setValueAtTime(a.compressor?(a.threshold??-18):0,t);compressor.ratio.setValueAtTime(a.compressor?(a.ratio??4):1,t);compressor.knee.setValueAtTime(a.compressor?12:0,t);compressor.attack.setValueAtTime((a.attack??10)/1000,t);compressor.release.setValueAtTime((a.release??150)/1000,t);
  limiter.threshold.setValueAtTime(a.limiter?-1:0,t);limiter.knee.setValueAtTime(0,t);limiter.ratio.setValueAtTime(a.limiter?20:1,t);limiter.attack.setValueAtTime(.003,t);limiter.release.setValueAtTime(.08,t);
 },setLevel(value:number,smooth=false){const t=context.currentTime;level.gain.cancelScheduledValues(t);if(smooth){level.gain.setValueAtTime(level.gain.value,t);level.gain.linearRampToValueAtTime(value,t+.005);}else level.gain.setValueAtTime(value,t);},dispose(){for(const node of nodes)node.disconnect();}};
}
