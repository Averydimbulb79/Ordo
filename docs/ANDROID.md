# Ordo for Android

## v0.2.1: import and saving fixes

Import now opens the media sheet automatically after files are selected, shows reading/result feedback and highlights the imported entries. Before clips are added, the preview shows a media-ready state and Choose clips action. Duplicate selections and failed reads have explicit messages.

Android JSON numbers for file sizes and chunk offsets can arrive as Integer rather than Long. The save bridge now validates whole numeric values without requiring Long. Unit regression checks cover normal sizes, zero and later chunk offsets, the limit boundary and invalid values. This fixes the false “Invalid file name or file exceeds…” rejection; the existing 256 MB save and two-minute export limits remain.

## Android foundation

One shared editor, packaged locally with Capacitor 8.5.3. Android is the primary platform; Electron/Windows work is deferred.

- Portrait and landscape phone layouts, a persistent bottom tool dock, and media/project/clip sheets.
- Touch timeline panning, ruler scrubbing, pinch zoom and selected-clip trim handles. Duplicate and earlier/later ordering controls.
- Capacitor system-bar inset handling with viewport-fit=contain, to keep editing controls outside the OS bars.
- Android's file chooser for import/relink/open, and a custom Storage Access Framework Save as bridge for projects and exported videos. Writes are chunked, counted and checked before success is reported. Cancelling Save as preserves unsaved project state.
- Android Back closes the current sheet/dialog before offering to exit. Playback pauses when the page becomes hidden. The screen stays awake during export.
- Installed app bundles the web build. Editing does not require an account or media upload. Keep the app in the foreground during export.

This is a test build of the existing single-track assembly workflow. It does not yet match Filmora/CapCut. Real-device import/playback/export and document-provider behaviour remain device test requirements.

## Install and update

The Android APK workflow builds each update to main and uploads an Ordo-Android artifact. It also publishes a stable download:

https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk

The link becomes available only after a successful first build. Install the APK on your Android device, allowing installation from your browser/file manager if prompted. Future test APKs use the same application ID and development signing certificate with a higher versionCode, so they can install over earlier test builds.

The repository contains an intentionally public development signing certificate (.github/development-signing.p12.base64, password android). It is for these test APKs only, not Play Store releases. Production distribution requires private signing credentials and a separate release process. Do not use this certificate as a trust boundary.

## Device checks

1. Confirm the top controls and bottom dock do not overlap system bars, including gesture navigation.
2. Import a short phone video, add it to the timeline and play it with sound.
3. Select a clip, trim with either handle, split, duplicate and undo.
4. Pinch the timeline to zoom and swipe to pan; try portrait and landscape.
5. Save an .ordo file to a chosen folder. Cancel Save as once and confirm edits still show as unsaved.
6. Close/reopen the app, open the project and relink the original footage.
7. Export a short MP4 or WebM with sound and save it through Android Save as. Play it in another player.
8. Install a later APK over the existing one without uninstalling; confirm local recovery is retained.

Browser codec support varies with Android System WebView and hardware. This first build retains the 720p/30 fps, two-minute export limit. The packaged app requires Android 7/API24 or later at the shell level; recent Android and an updated Android System WebView are recommended for editing. Codec checks may reject an unsupported file or output format.

## Build locally

Install Node 22.12+, JDK 21 and Android SDK platform 36. Then:

```sh
npm ci
npm run android:sync
base64 --decode .github/development-signing.p12.base64 > .github/development-signing.p12
cd android
./gradlew testDebugUnitTest assembleDebug lintDebug
```

ORDO_VERSION_CODE supplies the monotonically increasing test build number in GitHub. Keep appId and certificate stable between updates.

## Architecture and next engine decision

Current import/export uses Mediabunny/WebCodecs with Canvas 2D and Web Audio, shared with the browser. Capacitor supplies Android integration, not a faster video engine. If phone benchmarks expose unacceptable export performance or codec coverage, evaluate an Android Media3 Transformer bridge against the same project model before changing the processing path. No native render engine is integrated in v0.2.0.
