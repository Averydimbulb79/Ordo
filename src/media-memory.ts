import {openDB} from 'idb';
import {fileHash} from './media-identity';
import {nativeMediaUrl,forgetNativeMedia,rememberNativeUri} from './native';
import type {NativeMedia} from './native';
import type {Asset} from './model';
type Record={asset:Asset;file?:File;native?:NativeMedia};
const db=openDB('ordo-media',1,{upgrade(db){db.createObjectStore('media');}});
void db.catch(()=>{});
export const remembersMedia=()=>{try{return localStorage.getItem('ordo-remember-media')!=='false';}catch{return false;}};
export function setRemembersMedia(value:boolean){localStorage.setItem('ordo-remember-media',String(value));}
export async function nativeFile(media:NativeMedia){const response=await fetch(nativeMediaUrl(media.uri));if(!response.ok)throw new Error('Media access is no longer available. Locate the file again.');return rememberNativeUri(new File([await response.blob()],media.name,{type:media.mime||'application/octet-stream',lastModified:0}),media.uri);}
export async function rememberMedia(asset:Asset,file:File,native?:NativeMedia){
 if(!remembersMedia()||!asset.sha256)return;
 const record:Record={asset,...(native?.persisted?{native}:{file})};await(await db).put('media',record,asset.sha256);
}
export async function restoreMedia(asset:Asset):Promise<File|undefined>{
 if(!remembersMedia()||!asset.sha256)return;
 try{const record=await(await db).get('media',asset.sha256) as Record|undefined;if(!record)return;const file=record.native?await nativeFile(record.native):record.file;if(!file||file.size!==asset.size||await fileHash(file)!==asset.sha256)return;return file;}catch{return;}
}
export async function forgetMedia(){await(await db).clear('media');await forgetNativeMedia();}
