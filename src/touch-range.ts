/** A separate hit area prevents native range tap-to-jump before scroll intent is known.
 * The real range retains its accessible label, value and keyboard controls.
 */
export function protectTouchRange(input:HTMLInputElement){
 const wrapper=document.createElement('span');wrapper.className='touch-range';
 const hit=document.createElement('span');hit.className='touch-range-hit';hit.setAttribute('aria-hidden','true');
 // Defer wrapping until the caller has added the input to its label.
 queueMicrotask(()=>{if(!input.parentNode)return;input.before(wrapper);wrapper.append(input,hit);});
 let drag:{id:number;x:number;y:number;value:number;mode:'pending'|'scroll'|'adjust'|'mouse'}|undefined;
 const update=(value:number)=>{const min=Number(input.min),max=Number(input.max),step=Number(input.step)||1;
  input.value=String(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step)));input.dispatchEvent(new Event('input',{bubbles:true}));};
 const mouseValue=(x:number)=>{const rect=input.getBoundingClientRect(),inset=8;return Number(input.min)+(x-rect.left-inset)/Math.max(1,rect.width-2*inset)*(Number(input.max)-Number(input.min));};
 hit.addEventListener('pointerdown',event=>{
  event.preventDefault();if(drag)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value),mode:event.pointerType==='mouse'?'mouse':'pending'};
  hit.setPointerCapture(event.pointerId);
  if(drag.mode==='mouse'){input.focus({preventScroll:true});update(mouseValue(event.clientX));}
 });
 hit.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(drag.mode==='pending'){
   if(Math.abs(dy)>8&&Math.abs(dy)>=Math.abs(dx))drag.mode='scroll';
   else if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3){drag.mode='adjust';input.focus({preventScroll:true});}
  }
  if(drag.mode==='adjust'){
   event.preventDefault();const range=Number(input.max)-Number(input.min);
   update(drag.value+dx/Math.max(1,input.getBoundingClientRect().width)*range*.5);
  }else if(drag.mode==='mouse'){event.preventDefault();update(mouseValue(event.clientX));}
 },{passive:false});
 const finish=(event:PointerEvent)=>{
  if(!drag||drag.id!==event.pointerId)return;
  if(event.type==='pointercancel'&&drag.mode==='adjust')update(drag.value);
  if(event.type==='pointerup'&&(drag.mode==='adjust'||drag.mode==='mouse'))input.dispatchEvent(new Event('change',{bubbles:true}));
  drag=undefined;
  if(hit.hasPointerCapture(event.pointerId))hit.releasePointerCapture(event.pointerId);
 };
 hit.addEventListener('pointerup',finish);hit.addEventListener('pointercancel',finish);
 hit.addEventListener('click',event=>event.preventDefault());
}
