import { layersAt } from './model';
import type { Project, Clip } from './model';

export function paintComposition(ctx: CanvasRenderingContext2D, project: Project, frame: number, images: Map<string,CanvasImageSource>) {
 const {width,height}=ctx.canvas;ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
 for(const layer of layersAt(project,frame)){
  if(layer.track==='a1'||layer.track==='a2')continue;
  const asset=project.assets.find(a=>a.id===layer.clip.assetId),image=images.get(layer.clip.id);
  if(!image||asset?.kind!=='video')continue;
  const clip:Clip=layer.clip,factor=Math.min(width/asset.width,height/asset.height)*(clip.scale??1),w=asset.width*factor,h=asset.height*factor;
  ctx.save();ctx.globalAlpha=layer.weight*(clip.opacity??1);ctx.globalCompositeOperation=layer.track==='v1'?'lighter':'source-over';
  ctx.drawImage(image,(clip.x??.5)*width-w/2,(clip.y??.5)*height-h/2,w,h);ctx.restore();
 }
}
