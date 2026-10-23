export const TRANSITIONS=[
 ['dissolve','Cross dissolve'],['fade-black','Fade through black'],['fade-white','Fade through white'],
 ['wipe-left','Wipe left'],['wipe-right','Wipe right'],['wipe-up','Wipe up'],['wipe-down','Wipe down'],
 ['slide-left','Slide left'],['slide-right','Slide right'],['push-left','Push left'],['push-right','Push right'],
 ['zoom-in','Zoom in'],['zoom-out','Zoom out']
] as const;
export type Transition=typeof TRANSITIONS[number][0];
export const ADJUSTMENTS=[
 ['brightness','Brightness',-100,100,0],['contrast','Contrast',-100,100,0],['saturation','Saturation',-100,100,0],
 ['exposure','Exposure (stops)',-2,2,0],['highlights','Highlights',-100,100,0],['shadows','Shadows',-100,100,0],
 ['temperature','Temperature',-100,100,0],['tint','Tint',-100,100,0],['sharpen','Sharpen',0,100,0],
 ['vignette','Vignette',0,100,0],['fade','Fade',0,100,0]
] as const;
export type Adjustments=Partial<Record<typeof ADJUSTMENTS[number][0],number>>;
export type TextItem={id:string;kind:'title'|'caption';text:string;startFrame:number;frames:number;fontFamily:string;fontSize:number;color:string;rotation:number;bold:boolean;italic:boolean;underline:boolean;strike:boolean;x:number;y:number;align:'left'|'center'|'right';background:boolean;outline:boolean};
export function newText(kind:TextItem['kind'],startFrame:number):TextItem{
 return {id:crypto.randomUUID(),kind,text:kind==='title'?'Your title':'Your caption',startFrame,frames:90,fontFamily:'Roboto',fontSize:kind==='title'?72:42,color:'#ffffff',rotation:0,bold:kind==='title',italic:false,underline:false,strike:false,x:.5,y:kind==='title'?.5:.86,align:'center',background:kind==='caption',outline:true};
}
export function validateAdjustments(value:unknown):Adjustments{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid picture adjustments.');
 const result:Adjustments={};for(const [key,,min,max] of ADJUSTMENTS){const n=(value as Adjustments)[key];if(n!==undefined){if(!Number.isFinite(n)||n<min||n>max)throw new Error('Invalid picture adjustment value.');result[key]=n;}}
 return result;
}
export function parseTexts(value:unknown,fonts:readonly string[]):TextItem[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>1000)throw new Error('Invalid text timeline.');
 const ids=new Set<string>();
 return value.map(t=>{
  if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||!['title','caption'].includes(t.kind)||typeof t.text!=='string'||t.text.length>5000||!fonts.includes(t.fontFamily)||!/^#[0-9a-f]{6}$/i.test(t.color))throw new Error('Invalid title or caption.');
  for(const [key,min,max,integer] of [['startFrame',0,2592000,true],['frames',1,2592000,true],['fontSize',12,240,false],['rotation',-180,180,false],['x',0,1,false],['y',0,1,false]] as const)if(!Number.isFinite(t[key])||t[key]<min||t[key]>max||(integer&&!Number.isSafeInteger(t[key])))throw new Error('Invalid text timing or placement.');
  for(const key of ['bold','italic','underline','strike','background','outline'])if(typeof t[key]!=='boolean')throw new Error('Invalid text style.');
  if(!['left','center','right'].includes(t.align)||t.startFrame+t.frames>2592000)throw new Error('Invalid text alignment or timing.');
  ids.add(t.id);return {id:t.id,kind:t.kind,text:t.text,startFrame:t.startFrame,frames:t.frames,fontFamily:t.fontFamily,fontSize:t.fontSize,color:t.color,rotation:t.rotation,bold:t.bold,italic:t.italic,underline:t.underline,strike:t.strike,x:t.x,y:t.y,align:t.align,background:t.background,outline:t.outline};
 });
}
export const FONT_NAMES=["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Merriweather", "Playfair Display", "Source Sans 3", "Roboto Mono", "Oswald", "Raleway", "Inter", "Ubuntu", "Noto Sans", "Noto Serif", "PT Sans", "PT Serif", "Roboto Slab", "Rubik", "Work Sans", "Fira Sans", "Quicksand", "Barlow", "Mulish", "Manrope", "DM Sans", "DM Serif Display", "Libre Baskerville", "Libre Franklin", "Crimson Text", "Cormorant Garamond", "EB Garamond", "Lora", "Bitter", "Arvo", "Josefin Sans", "Josefin Slab", "Cabin", "Karla", "Inconsolata", "Source Code Pro", "Fira Code", "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono", "Space Grotesk", "Space Mono", "Righteous", "Anton", "Bebas Neue", "Pacifico", "Dancing Script", "Great Vibes", "Lobster", "Satisfy", "Caveat", "Comfortaa", "Exo 2", "Titillium Web", "Assistant", "Hind", "Oxygen", "Varela Round", "Archivo", "Dosis"] as const;
export function importCaptions(text:string):TextItem[]{
 if(text.length>1000000)throw new Error('Caption files must be smaller than 1 MB.');
 const normalized=text.replace(/^\uFEFF/,'').replace(/\r/g,''),blocks=normalized.split(/\n\s*\n/),items:TextItem[]=[];
 const stamp=(s:string)=>{const parts=s.replace(',','.').split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)))throw new Error('Invalid caption timestamp.');return Math.round(parts.reduce((n,p)=>n*60+p,0)*30);};
 for(const block of blocks){const lines=block.split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;
  const match=lines[i].match(/^\s*((?:\d+:)?\d{2}:\d{2}[,.]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[,.]\d{3})/);if(!match)throw new Error('Invalid caption timing line.');
  const start=stamp(match[1]),end=stamp(match[2]);if(end<=start)throw new Error('Caption end must follow its start.');
  items.push({...newText('caption',start),frames:end-start,text:lines.slice(i+1).join('\n').replace(/<[^>]*>/g,'')});
 }
 if(!items.length)throw new Error('No captions found. Choose an SRT or WebVTT file.');
 return parseTexts(items,FONT_NAMES);
}
export function captionsToSrt(items:TextItem[]):string{
 const stamp=(frame:number)=>{const ms=Math.round(frame/30*1000),s=Math.floor(ms/1000);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
 return items.filter(t=>t.kind==='caption').sort((a,b)=>a.startFrame-b.startFrame).map((t,i)=>`${i+1}\n${stamp(t.startFrame)} --> ${stamp(t.startFrame+t.frames)}\n${t.text.replace(/\n\s*\n/g,'\n')}`).join('\n\n')+'\n';
}
