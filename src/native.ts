import { Capacitor, registerPlugin } from '@capacitor/core';
interface OrdoFilesPlugin {
 beginSave(options: { name: string; mime: string; size: number }): Promise<{ cancelled: boolean; token?: string }>;
 append(options: { token: string; data: string; offset: number }): Promise<void>;
 finish(options: { token: string }): Promise<void>;
 abort(options: { token: string }): Promise<void>;
 keepAwake(options: { enabled: boolean }): Promise<void>;
 previewMode(options: { enabled: boolean }): Promise<void>;
 exit(): Promise<void>;
}
const NativeFiles = registerPlugin<OrdoFilesPlugin>('OrdoFiles');
export const isAndroid = Capacitor.getPlatform() === 'android';
export async function keepAwake(enabled: boolean) { if (isAndroid) await NativeFiles.keepAwake({ enabled }); }
export async function previewMode(enabled:boolean){if(isAndroid)await NativeFiles.previewMode({enabled});}
export async function exitAndroid() { if (isAndroid) await NativeFiles.exit(); }
export async function saveAndroid(blob: Blob, name: string): Promise<'saved' | 'cancelled'> {
 const result = await NativeFiles.beginSave({ name, mime: blob.type || 'application/octet-stream', size: blob.size });
 if (result.cancelled || !result.token) return 'cancelled';
 const token = result.token;
 try {
  const chunkSize = 256 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
   const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
   let binary = ''; const block = 8192;
   for (let p = 0; p < bytes.length; p += block) binary += String.fromCharCode(...bytes.subarray(p, p + block));
   await NativeFiles.append({ token, data: btoa(binary), offset });
  }
  await NativeFiles.finish({ token }); return 'saved';
 } catch (error) { await NativeFiles.abort({ token }).catch(() => {}); throw error; }
}
