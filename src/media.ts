import { isAndroid, saveAndroid } from './native';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { Asset } from './model';
export type LocalMedia = { file: File; url: string };
export async function inspect(file: File): Promise<Asset> {
 const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
 try {
  const [seconds, video, audio] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
  if (video && !await video.canDecode()) throw new Error('This browser cannot decode the video codec in this file.');
  if (audio && !await audio.canDecode()) throw new Error('This browser cannot decode the audio codec in this file.');
  if (!video && !audio) throw new Error('No video or audio track found.');
  if (!Number.isFinite(seconds) || seconds < 1 / 30 || seconds > 86400) throw new Error('Choose media between one frame and 24 hours.');
  return { id: crypto.randomUUID(), name: file.name, size: file.size, modified: file.lastModified, duration: seconds, kind: video ? 'video' : 'audio', width: video?.displayWidth ?? 0, height: video?.displayHeight ?? 0 };
 } finally { input.dispose(); }
}
export async function download(blob: Blob, name: string): Promise<'saved' | 'requested' | 'cancelled'> {
 if (isAndroid) return saveAndroid(blob, name);
 const url = URL.createObjectURL(blob), anchor = document.createElement('a');
 anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
 setTimeout(() => URL.revokeObjectURL(url), 60_000);
 return 'requested';
}
export function drawContained(ctx: CanvasRenderingContext2D, source?: CanvasImageSource | null, sourceWidth?: number, sourceHeight?: number) {
 const { width, height } = ctx.canvas;
 ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
 if (!source || !sourceWidth || !sourceHeight) return;
 const scale = Math.min(width / sourceWidth, height / sourceHeight), w = sourceWidth * scale, h = sourceHeight * scale;
 ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
}
