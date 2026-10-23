export type Crop={x:number;y:number;width:number;height:number};
export const CROP_RATIOS=[['original','Original'],['16:9','16:9 · Landscape'],['9:16','9:16 · Portrait'],['1:1','1:1 · Square'],['4:3','4:3'],['3:4','3:4'],['4:5','4:5 · Social'],['21:9','21:9 · Cinema'],['free','Free size']] as const;
export function cropPreset(ratio:string,width:number,height:number):Crop{
 if(ratio==='original'||ratio==='free')return {x:0,y:0,width:1,height:1};
 const [a,b]=ratio.split(':').map(Number),target=a/b,source=width/height;
 const w=target<source?target/source:1,h=target<source?1:source/target;return{x:(1-w)/2,y:(1-h)/2,width:w,height:h};
}
export function validateCrop(value:unknown):Crop{
 const c=value as Crop;if(!c||typeof c!=='object'||!['x','y','width','height'].every(k=>Number.isFinite(c[k as keyof Crop])))throw new Error('Invalid crop box.');
 if(c.x<0||c.y<0||c.width<.02||c.height<.02||c.x+c.width>1.000001||c.y+c.height>1.000001)throw new Error('Keep the crop inside the picture.');return{x:c.x,y:c.y,width:c.width,height:c.height};
}
