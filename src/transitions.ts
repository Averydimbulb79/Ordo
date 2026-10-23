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
  draw(b);draw(a,1-t,0,0,1+.5*t);
 }else{draw(a);draw(b,t);}
 ctx.restore();
}
