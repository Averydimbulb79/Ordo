## Ordo

An Android-first video editor, with a shared web build. Local editing, no account or media upload required, and no AI features.

[Open web editor](https://averydimbulb79.github.io/Ordo/) · [Android APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Roadmap](docs/ROADMAP.md) · [Android guide](docs/ANDROID.md)

### v0.3.0: media thumbnails, multitrack and dissolves

- Project media shows a video thumbnail, duration badge and readable filename. Audio and missing media retain clear placeholders.
- Four tracks: V1 for the main assembly, V2 for overlapping video, and A1/A2 for independent soundtracks. Choose a destination on each media card before adding.
- V2 defaults to picture-in-picture. Edit controls change a clip's track, start time, scale, position, opacity and volume.
- Cross-dissolves between adjacent V1 clips, including sound crossfades. Select the outgoing clip, open Edit and choose its transition to the next clip.
- Shared composition rules for preview/export; splitting, trimming, duplication, undo/redo, project save/reopen/relink and local recovery remain available.
- Portrait/landscape touch workspace with pinch zoom and horizontal/vertical timeline panning; native Android saving and install-over updates.

### First edit on your phone

1. Import a short video. Project media opens with confirmation, a thumbnail and duration.
2. Choose V1, then Add to sequence. Use V2 for an overlay, or A1/A2 for sound. Tap Done.
3. Tap a timeline clip and open Edit for timing, picture placement, volume or a transition. Swipe vertically in the timeline to reach lower tracks.
4. Save your .ordo project through Project. Keep the original footage for relinking.
5. Export and save the finished video; play it in another player to verify sound and picture on your phone.

V1 closes gaps automatically; V2/A1/A2 have independent start times and allow gaps. Clips on the same independent track cannot overlap. New clips append to the chosen track at its end or the playhead, whichever is later. A dissolve overlaps two V1 clips, shortening the sequence by that overlap; short clips use a shorter dissolve. Other transition types and keyframe animation are not yet implemented.

Current export limits remain 1280 × 720 / 30 fps, two minutes and a 256 MB Android save limit. MP4 (H.264/AAC) and WebM (VP8/Opus) depend on device codec support. Keep the app in the foreground during export. Audio is mixed in one-second blocks; the final encoded output is still assembled in memory. Real-phone performance and hardware codecs require device testing.

Project format v2 preserves the new settings and reads older v1 projects. Older Ordo versions cannot open newly saved v2 projects. Source media and thumbnail images are not embedded in .ordo files. Test APKs use the documented public development signing certificate, with the same application ID and increasing versionCode.

### Feature direction

The goal is to rival Filmora Mobile and CapCut's traditional editing workflows. Keyframes are the diamond-shaped points that animate values such as position, scale, opacity and volume over time. They, speed curves, text/manual captions, masks, chroma key, more transitions, colour tools and advanced audio mixing remain roadmap targets. Windows work is deferred.

### Development

Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:mobile
npm run test:composition
```

Browser tests require ffmpeg. Android builds require JDK 21 and Android SDK 36. GitHub Actions tests main, publishes the web build and builds an installable APK. Consult [Actions](https://github.com/Averydimbulb79/Ordo/actions) for current results.

Preserve rollback checkpoints before substantial changes and update this README each release. Ordo retains its MIT licence; dependency licences also apply. [Components](docs/COMPONENTS.md) · [Validation](docs/VALIDATION.md)
