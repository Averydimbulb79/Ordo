import type { TextItem } from './creative-model';
export function paintText(ctx:CanvasRenderingContext2D,item:TextItem,scale=1){
 const size=item.fontSize*scale,lineHeight=size*1.25,maxWidth=ctx.canvas.width*.9;
 ctx.save();ctx.translate(item.x*ctx.canvas.width,item.y*ctx.canvas.height);ctx.rotate(item.rotation*Math.PI/180);
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
