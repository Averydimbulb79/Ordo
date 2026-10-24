import type { Project } from './model';
export type ExportSettings={resolution:number;fps:number;quality:'compact'|'standard'|'high'};
export const DEFAULT_EXPORT:ExportSettings={resolution:720,fps:30,quality:'standard'};
export function exportDimensions(project:Pick<Project,'width'|'height'>,settings:ExportSettings){
 if(![480,720,1080,2160].includes(settings.resolution)||![24,25,30,50,60].includes(settings.fps)||!['compact','standard','high'].includes(settings.quality))throw new Error('Invalid export settings.');
 const ratio=project.width/project.height,short=settings.resolution,width=Math.round((ratio>=1?short*ratio:short)/2)*2,height=Math.round((ratio>=1?short:short/ratio)/2)*2;
 const base=settings.resolution<=480?1_000_000:settings.resolution===720?2_000_000:settings.resolution===1080?4_000_000:12_000_000;
 return{width,height,fps:settings.fps,bitrate:Math.round(base*(settings.fps>30?1.5:1)*(settings.quality==='compact'?.6:settings.quality==='high'?2:1))};
}
