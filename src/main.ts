import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { Application, Graphics } from 'pixi.js';
import { openDB } from 'idb';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
<header><a class="brand" href="./">ordo<span class="brand-dot"></span></a><span class="version">0.0.1 · Component Lab</span><a class="repo" href="https://github.com/Averydimbulb79/Ordo">GitHub ↗</a></header>
<main><div class="eyebrow">FOUNDATION RELEASE</div><h1>Every story starts<br>with a working foundation.</h1><p class="intro">The first step towards Ordo: checking the components that will power your editor. Editing and export are not available in this release.</p>
<section class="checks" aria-label="Component checks"><article><span class="label">MEDIA TOOLKIT</span><h2>Mediabunny</h2><p>1.62.0 · Media reading and writing</p><span class="status good">Module loaded</span></article><article><span class="label">COMPOSITION</span><h2>PixiJS</h2><p>8.22.0 · Visual rendering</p><span id="graphics-status" class="status">Testing…</span><div id="graphics" aria-label="Graphics rendering test"></div></article><article><span class="label">RECOVERY STORAGE</span><h2>IndexedDB</h2><p>idb 8.0.4 · Local data storage</p><span id="storage-status" class="status">Testing…</span></article></section>
<section class="media"><div><div class="eyebrow">LOCAL MEDIA CHECK</div><h2>Try a video or audio file</h2><p>Your file stays on this device. This test reads its metadata; it does not upload, edit or convert it.</p></div><button class="button" id="choose-media" type="button">Choose media</button><input id="media-file" type="file" accept="video/*,audio/*" hidden><pre id="media-result" aria-live="polite">No file selected.</pre></section>
<section class="capabilities"><h2>Browser capabilities</h2><p>Availability varies by browser, codec and hardware. Passing these checks does not establish editing performance.</p><ul id="capabilities"></ul></section>
<footer>One web editor. An Electron Windows edition after the web workflow is proven. No AI.</footer></main>`;

function status(id: string, message: string, good: boolean) {
 const el = document.getElementById(id)!;
 el.textContent = message;
 el.className = `status ${good ? 'good' : 'limited'}`;
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

async function checkStorage() {
 try {
  const db = await openDB('ordo-component-lab', 1, { upgrade(db) { db.createObjectStore('checks'); } });
  try {
   const token = crypto.randomUUID();
   await db.put('checks', token, token);
   if (await db.get('checks', token) !== token) throw new Error('Read-back failed');
   await db.delete('checks', token);
  } finally { db.close(); }
  status('storage-status', 'Write and read verified', true);
 } catch (error) { status('storage-status', `Unavailable: ${message(error)}`, false); }
}
async function checkGraphics() {
 const app = new Application();
 try {
  await app.init({ width: 240, height: 48, backgroundAlpha: 0, preference: 'webgl', autoStart: false });
  app.stage.addChild(new Graphics().roundRect(0, 8, 75, 28, 5).fill(0x82d8c2).roundRect(80, 8, 100, 28, 5).fill(0x8b9fe8).roundRect(185, 8, 45, 28, 5).fill(0xd1a6dc));
  document.getElementById('graphics')!.append(app.canvas);
  app.render();
  status('graphics-status', 'WebGL render completed', true);
 } catch (error) { status('graphics-status', `Unavailable: ${message(error)}`, false); }
}

const capabilities: Array<[string, boolean]> = [
 ['Video decoding API', 'VideoDecoder' in window],
 ['Video encoding API', 'VideoEncoder' in window],
 ['Audio processing API', 'AudioContext' in window],
 ['Direct file saving API', 'showSaveFilePicker' in window],
];
for (const [label, supported] of capabilities) {
 const li = document.createElement('li');
 li.textContent = `${label}: ${supported ? 'available' : 'unavailable'}`;
 document.getElementById('capabilities')!.append(li);
}

document.getElementById('choose-media')!.addEventListener('click', () => document.querySelector<HTMLInputElement>('#media-file')!.click());
let selection = 0;
document.getElementById('media-file')!.addEventListener('change', async event => {
 const file = (event.target as HTMLInputElement).files?.[0];
 if (!file) return;
 const request = ++selection;
 const output = document.getElementById('media-result')!;
 output.textContent = 'Reading metadata…';
 const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
 try {
  const [duration, video, audio] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
  if (request !== selection) return;
  output.textContent = [file.name, `Size: ${(file.size / 1048576).toFixed(2)} MB`, `Duration: ${duration.toFixed(3)} seconds`, video ? `Video: ${video.codec}, ${video.displayWidth} × ${video.displayHeight}` : 'Video: none', audio ? `Audio: ${audio.codec}, ${audio.sampleRate} Hz, ${audio.numberOfChannels} channel(s)` : 'Audio: none'].join('\n');
 } catch (error) {
  if (request === selection) output.textContent = `Could not read this file: ${message(error)}`;
 } finally { input.dispose(); }
});
void checkStorage();
void checkGraphics();
