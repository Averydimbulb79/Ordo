import { layersAt } from './model';
import type { Project, Clip } from './model';
import { ColorProcessor } from './adjustments';
import { paintTransition } from './transitions';
import { paintText } from './text-renderer';

type Buffers={a:HTMLCanvasElement;b:HTMLCanvasElement;source:HTMLCanvasElement;color?:ColorProcessor};
const cache=new WeakMap<CanvasRenderingContext2D,Buffers>();
export function paintComposition(ctx:CanvasRenderingContext2D,project:Project,frame:number,images:Map<string,CanvasImageSource>,bypassAdjustments=false){
 const {width,height}=ctx.canvas;let buffers=cache.get(ctx);
 if(!buffers){buffers={a:document.createElement('canvas'),b:document.createElement('canvas'),source:document.createElement('canvas')};cache.set(ctx,buffers);}

 const draw=(target:CanvasRenderingContext2D,clip:Clip)=>{
  const asset=project.assets.find(a=>a.id===clip.assetId),image=images.get(clip.id);if(!asset||asset.kind!=='video'||!image)return;
  const crop=clip.crop??{x:0,y:0,width:1,height:1},source=image as {videoWidth?:number;videoHeight?:number;width?:number;height?:number};
  const iw=source.videoWidth||source.width||asset.width,ih=source.videoHeight||source.height||asset.height;
  const sw=iw*crop.width,sh=ih*crop.height,aspect=asset.width*crop.width/(asset.height*crop.height);
  const baseWidth=Math.min(width,height*aspect),baseHeight=baseWidth/aspect;let drawable:CanvasImageSource=image;
  if(!bypassAdjustments&&clip.adjustments&&Object.values(clip.adjustments).some(v=>v!==0)){
   const scratch=buffers!.source,w=Math.max(1,Math.round(baseWidth)),h=Math.max(1,Math.round(baseHeight));if(scratch.width!==w||scratch.height!==h){scratch.width=w;scratch.height=h;}
   scratch.getContext('2d')!.drawImage(image,iw*crop.x,ih*crop.y,sw,sh,0,0,w,h);buffers!.color??=new ColorProcessor();drawable=buffers!.color.render(scratch,clip.adjustments);
  }
  const w=baseWidth*(clip.scale??1),h=baseHeight*(clip.scale??1),x=(clip.x??.5)*width-w/2,y=(clip.y??.5)*height-h/2;
  target.save();target.globalAlpha*=clip.opacity??1;
  if(drawable===image)target.drawImage(image,iw*crop.x,ih*crop.y,sw,sh,x,y,w,h);else target.drawImage(drawable,x,y,w,h);target.restore();
 };
 ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
 const layers=layersAt(project,frame),main=layers.filter(e=>e.track==='v1');
 if(main.length===1)draw(ctx,main[0].clip);
 else if(main.length>1){
  const type=main[0].clip.transition??'dissolve';
  if(type==='dissolve'){for(const layer of main){ctx.save();ctx.globalAlpha=layer.weight;ctx.globalCompositeOperation='lighter';draw(ctx,layer.clip);ctx.restore();}}
  else{
   for(const c of [buffers.a,buffers.b])if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
   const a=buffers.a.getContext('2d')!,b=buffers.b.getContext('2d')!;a.fillStyle=b.fillStyle='#000';a.fillRect(0,0,width,height);b.fillRect(0,0,width,height);draw(a,main[0].clip);draw(b,main[1].clip);paintTransition(ctx,buffers.a,buffers.b,type,main[1].weight);
  }
 }
 for(const layer of layers.filter(e=>e.track==='v2'))draw(ctx,layer.clip);
 for(const text of project.texts??[])if(frame>=text.startFrame&&frame<text.startFrame+text.frames)paintText(ctx,text,width/project.width);
}
