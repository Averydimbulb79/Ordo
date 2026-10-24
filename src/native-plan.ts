import { duration, placements } from './model.ts';
import type { Project } from './model.ts';
import type { Format } from './export-formats.ts';
// Native eligibility is deliberately conservative. No edit may silently disappear.
export function nativeExportReason(project:Project,format:Format,hasUri:(assetId:string)=>boolean):string|null{
 if(format==='webm')return 'WebM uses the compatible exporter.';
 if(!project.clips.length)return 'Add a clip before exporting.';
 const entries=placements(project),pictures=entries.filter(e=>!e.track.startsWith('a'));
 if(!pictures.length)return 'Audio-only timelines use the compatible compositor.';
 if(pictures.some(e=>e.track!=='v1'))return 'Picture overlays use the compatible compositor.';
 if(Math.max(...pictures.map(e=>e.end))!==duration(project))return 'An audio tail or titles beyond the picture uses the compatible compositor.';
 for(const {clip} of pictures){
  if(!hasUri(clip.assetId))return 'Native export needs Android source access. Relink the picture media to enable it.';
  if(clip.transitionFrames||clip.startTransition?.frames||clip.endTransition?.frames)return 'Animated transitions use the compatible compositor.';
  if(Object.values(clip.adjustments??{}).some(v=>v!==0))return 'Colour adjustments use the compatible compositor.';
  if((clip.opacity??1)!==1)return 'Picture opacity uses the compatible compositor.';
  const asset=project.assets.find(a=>a.id===clip.assetId);
  if(asset?.kind!=='video'&&asset?.kind!=='image')return 'Audio-only picture clips use the compatible compositor.';
  if(asset?.kind==='image'&&!/\.(jpe?g|png)$/i.test(asset.name))return 'This still-image format uses the compatible compositor.';
 }
 return null;
}
