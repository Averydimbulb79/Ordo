import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';

function wav() {
 const sampleRate = 8000, samples = 800;
 const bytes = new Uint8Array(44 + samples * 2);
 const view = new DataView(bytes.buffer);
 function text(offset, value) { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); }
 text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
 view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
 view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
 text(36, 'data'); view.setUint32(40, samples * 2, true);
 return bytes;
}
test('reads duration and audio metadata from a generated PCM WAV', async () => {
 const input = new Input({ source: new BufferSource(wav()), formats: ALL_FORMATS });
 try {
  assert.ok(Math.abs(await input.computeDuration() - 0.1) < 0.000001);
  const audio = await input.getPrimaryAudioTrack();
  assert.ok(audio); assert.equal(audio.sampleRate, 8000); assert.equal(audio.numberOfChannels, 1);
  assert.equal(await input.getPrimaryVideoTrack(), null);
 } finally { input.dispose(); }
});
test('rejects invalid media instead of reporting an empty successful import', async () => {
 const input = new Input({ source: new BufferSource(new Uint8Array([1, 2, 3, 4])), formats: ALL_FORMATS });
 try { await assert.rejects(() => input.computeDuration()); } finally { input.dispose(); }
});
