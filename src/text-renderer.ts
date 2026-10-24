import { paintEdge } from './transitions';
import type { TextItem } from './creative-model';
export function paintText(ctx:CanvasRenderingContext2D,item:TextItem,scale=1){
 const size=item.fontSize*scale,lineHeight=size*1.25,maxWidth=ctx.canvas.width*.9;
 ctx.save();ctx.globalAlpha*=item.opacity??1;ctx.translate(item.x*ctx.canvas.width,item.y*ctx.canvas.height);ctx.rotate(item.rotation*Math.PI/180);
 ctx.font=`${item.italic?'italic':'normal'} ${item.bold?700:400} ${size}px "${item.fontFamily}"`;ctx.textBaseline='alphabetic';ctx.textAlign=item.align;
 const lines:string[]=[];
 for(const paragraph of item.text.split('\n')){
  let line='';for(const character of Array.from(paragraph)){
   if(line&&ctx.measureText(line+character).width>maxWidth){lines.push(line);line='';}line+=character;
  }lines.push(line);
 }
 const top=-(lines.length-1)*lineHeight/2;
 for(const [i,line] of lines.entries()){
  const width=ctx.measureText(line).width,left=item.align==='center'?-width/2:item.align==='right'?-width:0,y=top+i*lineHeight;
  if(item.background){ctx.fillStyle='#000000b8';ctx.fillRect(left-12,y-size-6,width+24,lineHeight+10);}
  if(item.outline){ctx.strokeStyle='#000';ctx.lineWidth=Math.max(2,size*.055);ctx.lineJoin='round';ctx.strokeText(line,0,y);}
  ctx.fillStyle=item.color;ctx.fillText(line,0,y);ctx.strokeStyle=item.color;ctx.lineWidth=Math.max(1,size*.045);
  for(const offset of [...(item.underline?[size*.13]:[]),...(item.strike?[-size*.31]:[])]){ctx.beginPath();ctx.moveTo(left,y+offset);ctx.lineTo(left+width,y+offset);ctx.stroke();}
 }
 ctx.restore();
}

const textLayers=new WeakMap<CanvasRenderingContext2D,{raw:HTMLCanvasElement;edge:HTMLCanvasElement}>();
export function paintAnimatedText(ctx:CanvasRenderingContext2D,item:TextItem,scale:number,offset:number){
 const start=Math.min(item.startTransition?.frames??0,item.frames),end=Math.min(item.endTransition?.frames??0,item.frames);
 const entering=start>0&&offset<start,leaving=end>0&&offset>=item.frames-end;
 if(!entering&&!leaving){paintText(ctx,item,scale);return;}
 let layers=textLayers.get(ctx);if(!layers){layers={raw:document.createElement('canvas'),edge:document.createElement('canvas')};textLayers.set(ctx,layers);}
 for(const c of [layers.raw,layers.edge]){if(c.width!==ctx.canvas.width||c.height!==ctx.canvas.height){c.width=ctx.canvas.width;c.height=ctx.canvas.height;}else c.getContext('2d')!.clearRect(0,0,c.width,c.height);}
 paintText(layers.raw.getContext('2d')!,item,scale);
 if(entering)paintEdge(layers.edge.getContext('2d')!,layers.raw,item.startTransition!.type,offset/start,true);else layers.edge.getContext('2d')!.drawImage(layers.raw,0,0);
 if(leaving)paintEdge(ctx,layers.edge,item.endTransition!.type,(offset-item.frames+end)/end,false);else ctx.drawImage(layers.edge,0,0);
}
export function textBounds(ctx:CanvasRenderingContext2D,item:TextItem,scale=1){
 const size=item.fontSize*scale,lineHeight=size*1.25,maxWidth=ctx.canvas.width*.9;ctx.save();ctx.font=`${item.italic?'italic':'normal'} ${item.bold?700:400} ${size}px "${item.fontFamily}"`;
 const lines:string[]=[];for(const paragraph of item.text.split('\n')){let line='';for(const c of Array.from(paragraph)){if(line&&ctx.measureText(line+c).width>maxWidth){lines.push(line);line='';}line+=c;}lines.push(line);}
 const width=Math.max(1,...lines.map(line=>ctx.measureText(line).width));ctx.restore();
 return{x:(item.align==='center'?-width/2:item.align==='right'?-width:0)-12,y:-(lines.length-1)*lineHeight/2-size-6,width:width+24,height:(lines.length-1)*lineHeight+lineHeight+10};
}
