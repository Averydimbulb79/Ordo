## Ordo

An Android-first video editor, with a shared web build for testing. Local editing, no account or media upload required, and no AI features.

[Open web editor](https://averydimbulb79.github.io/Ordo/) · [Android APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Roadmap](docs/ROADMAP.md) · [Android guide](docs/ANDROID.md)

### v0.2.0: Android foundation

- Touch workspace with preview/timeline, bottom tool dock and media, clip and project sheets.
- Swipe to pan, pinch to zoom, drag selected-clip trim handles and scrub the ruler.
- Import video/audio; split, trim, duplicate, reorder, delete and undo/redo on one sequential track.
- Preview with sound, adjust clip volume, save/reopen .ordo projects and relink source media.
- Android Save as for projects and exported videos; native Back handling and system-bar accommodation.
- GitHub builds an installable APK with stable development signing for install-over updates.

The APK link becomes available after the first successful Android build. See [Actions](https://github.com/Averydimbulb79/Ordo/actions) for current results. Test builds use the documented public development certificate; production signing is a later distribution step.

### First edit on your phone

1. Install the APK and open Ordo, or try the web link in Chrome.
2. Tap Media, import a short video, then Add to sequence and Done.
3. Tap a timeline clip. Use Split/Duplicate in the dock or Edit for trim, volume and ordering.
4. Open Project to save your edit. Keep the original footage for relinking after reopening.
5. Tap Export, choose a supported format, and save the finished video.

Current limits: one sequential track, fixed 1280 × 720 / 30 fps and exports up to two minutes. MP4 (H.264/AAC) and WebM (VP8/Opus) depend on the device/browser's codec support. Recent Android and an updated Android System WebView are recommended. Keep the app in the foreground during export. Phone hardware, memory and file-provider behaviour still require real-device testing.

### Feature direction

The goal is to rival Filmora Mobile and CapCut's traditional editing workflows: overlapping tracks, photos, keyframes, speed curves, text/manual captions, masks, chroma key, transitions, colour tools and audio mixing. These are staged roadmap targets, not features already implemented. Windows development is deferred.

### Development

Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
```

```sh
npx playwright install chromium
npm run test:browser
npm run test:mobile
```

Browser tests require ffmpeg. Android builds require JDK 21 and Android SDK 36; see the Android guide. GitHub Actions builds/tests main, publishes the web build and builds the APK.

### Project protection

.ordo files contain editing instructions and source references, not embedded media. Save them alongside your original footage. Local recovery snapshots are an additional aid. Preserve rollback checkpoints before substantial changes and update this README each release.

v0.1.0 is preserved on backup/v0.1.0-before-android; v0.0.1 source remains in legacy/v0.0.1. Ordo retains its MIT licence; dependency licences also apply. [Components](docs/COMPONENTS.md) · [Validation](docs/VALIDATION.md)
