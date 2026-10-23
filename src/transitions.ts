import type { Transition } from './creative-model';

export function paintTransition(ctx:CanvasRenderingContext2D,a:HTMLCanvasElement,b:HTMLCanvasElement,type:Transition,t:number){
 const {width:w,height:h}=ctx.canvas;t=Math.max(0,Math.min(1,t));ctx.save();
 const draw=(image:HTMLCanvasElement,alpha=1,x=0,y=0,scale=1)=>{ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+w/2,y+h/2);ctx.scale(scale,scale);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();};
 if(type==='fade-black'||type==='fade-white'){
  ctx.fillStyle=type==='fade-white'?'#fff':'#000';ctx.fillRect(0,0,w,h);if(t<.5)draw(a,1-t*2);else draw(b,t*2-1);
 }else if(type.startsWith('wipe-')){
  draw(a);ctx.beginPath();if(type==='wipe-left')ctx.rect(w*(1-t),0,w*t,h);if(type==='wipe-right')ctx.rect(0,0,w*t,h);if(type==='wipe-up')ctx.rect(0,h*(1-t),w,h*t);if(type==='wipe-down')ctx.rect(0,0,w,h*t);ctx.clip();draw(b);
 }else if(type==='slide-left'||type==='slide-right'){
  draw(a);draw(b,1,(type==='slide-left'?1:-1)*w*(1-t));
 }else if(type==='push-left'||type==='push-right'){
  const sign=type==='push-left'?1:-1;draw(a,1,-sign*w*t);draw(b,1,sign*w*(1-t));
 }else if(type==='zoom-in'){
  draw(a);draw(b,t,0,0,.5+.5*t);
 }else if(type==='zoom-out'){
  draw(b);draw(a,1-t,0,0,1-.5*t);
 }else{draw(a);draw(b,t);}
 ctx.restore();
}

const edgeColors=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>();
// Edge animations operate on a transparent clip layer so V2 reveals the picture below it.
export function paintEdge(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,type:Transition,progress:number,start:boolean){
 const {width:w,height:h}=ctx.canvas,amount=Math.max(0,Math.min(1,start?progress:1-progress));
 ctx.save();
 if(type==='fade-black'||type==='fade-white'){
  let mixed=edgeColors.get(image);if(!mixed){mixed=document.createElement('canvas');edgeColors.set(image,mixed);}if(mixed.width!==w||mixed.height!==h){mixed.width=w;mixed.height=h;}
  const color=mixed.getContext('2d')!;color.clearRect(0,0,w,h);color.save();color.drawImage(image,0,0);color.globalCompositeOperation='source-in';color.globalAlpha=1-amount;color.fillStyle=type==='fade-white'?'#fff':'#000';color.fillRect(0,0,w,h);color.globalCompositeOperation='lighter';color.globalAlpha=amount;color.drawImage(image,0,0);color.restore();ctx.drawImage(mixed,0,0);ctx.restore();return;
 }else if(type.startsWith('wipe-')){
  const direction=start?type:({'wipe-left':'wipe-right','wipe-right':'wipe-left','wipe-up':'wipe-down','wipe-down':'wipe-up'} as Record<string,string>)[type];ctx.beginPath();if(direction==='wipe-left')ctx.rect(w*(1-amount),0,w*amount,h);if(direction==='wipe-right')ctx.rect(0,0,w*amount,h);if(direction==='wipe-up')ctx.rect(0,h*(1-amount),w,h*amount);if(direction==='wipe-down')ctx.rect(0,0,w,h*amount);ctx.clip();
 }else if(type.startsWith('slide-')||type.startsWith('push-')){
  ctx.translate((type.endsWith('left')?1:-1)*(start?1:-1)*w*(1-amount),0);
 }else if(type==='zoom-in'||type==='zoom-out'){
  const grow=type==='zoom-in';const scale=(start===grow)?.5+.5*amount:1.5-.5*amount;ctx.translate(w/2,h/2);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);ctx.globalAlpha*=amount;
 }else ctx.globalAlpha*=amount;
 ctx.drawImage(image,0,0);ctx.restore();
}
