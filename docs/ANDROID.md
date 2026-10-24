# Ordo for Android

## Distribution

| Destination | Purpose |
| --- | --- |
| [Ordo website](https://averydimbulb79.github.io/Ordo/) | Android product information and download links |
| [Latest APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) | Installable development build |
| Internal browser harness | Capacitor engine development and automated checks; no public web editor |

## v0.4.0: creative panels, crop and output settings

Android has a second dock row for Transitions, Title, Captions, Crop and Adjust; landscape places all ten dock actions in one row. Creative panels open as bottom sheets in portrait, with live drafts, explicit Apply/Cancel and native Back cancellation. The original application identity, icon and signing certificate are retained.

The shared Canvas compositor implements thirteen V1 transitions, timed styled text, cropped source regions and eleven grading controls. Colour processing uses conventional WebGL with a CPU fallback; it is not AI. Fonts are bundled via pinned Fontsource packages, so rendering the supported Latin font styles does not require Google network calls. Source media is not uploaded.

Export choices are 480/720/1080/2160p, 24/25/30/50/60 FPS and three quality levels. The chosen short-edge resolution follows the canvas orientation; codec support is checked with those dimensions/FPS. Timeline events remain at 30 FPS and export samples their timestamps at the output FPS. Audio uses integer sample blocks for all offered frame rates. Final encoded output is still in memory; the two-minute and 256 MB save limits remain, with an estimate check for oversized Android exports. 4K/60 and every phone/codec combination are not certified by desktop tests.

Crop can retain the canvas aspect or optionally match it to the selected source region. Free-size corner dragging and numeric coordinates are supported. Crop, grading, transition type, title/caption timing/styles and canvas dimensions persist in project format v4 alongside audio settings, audio crossfades and source fingerprints. Earlier v1/v2/v3 files migrate when saved; older app versions cannot read v4. Caption imports support SRT and VTT; SRT exports contain text/timing, while the styled captions are burned into video output.

## v0.3.0: media and multitrack

Media cards show a decoded video thumbnail, source duration and filename. Thumbnails are small, serially generated, cached against the live File and recreated after relinking. A failed thumbnail does not invalidate otherwise usable media.

V1 is the main assembly track; V2 layers a second video; A1 and A2 carry independent sound. Choose the destination in Project media, or change track/start time in Edit. V2 initially uses a smaller picture-in-picture placement. Picture controls adjust position, scale and opacity. Main-track cross-dissolves overlap adjacent clips, shorten the timeline accordingly and crossfade their sound. Timeline panning works horizontally and vertically on touch devices.

Format v2 persists track placement, transforms and transitions. Older v1 projects are read and upgraded when saved; older Ordo releases cannot read the new format. Keyframe automation is still planned.

Preview uses several browser media players and a shared Canvas compositor. Export uses the same placement/blend rules, sequential video decoding, a reusable bounded frame copy per video clip and continuous audio processing with one-second source-decoding windows and an in-memory final stereo mix. Final encoded output is still held in memory, so the existing export/save limits remain. Device performance is not established by desktop tests.

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

This is a test build with a four-track editing baseline. It does not yet match Filmora/CapCut. Real-device import/playback/export and document-provider behaviour remain device test requirements.

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

Current import/export uses Mediabunny/WebCodecs with Canvas 2D and Web Audio, shared with the browser. Capacitor supplies Android integration, not a faster video engine. If phone benchmarks expose unacceptable export performance or codec coverage, evaluate an Android Media3 Transformer bridge against the same project model before changing the processing path. No native render engine is integrated in v0.4.0.

### Fullscreen preview (v0.4.2)

The bottom-right preview button expands the player with its controls. Android uses WindowInsetsControllerCompat to hide system bars and SCREEN_ORIENTATION_FULL_SENSOR while previewing, then restores the prior orientation and visible bars. Back exits preview before closing a panel or exiting the app. Resuming or rotating reapplies immersive bars. Multi-window and large-screen orientation policies may be controlled by Android. Real-device rotation, cutout insets and hardware HEVC encoding require phone verification; desktop browser tests cannot establish these.

### Remembered media and audio (v0.5.0)

Import and Locate missing media use ACTION_OPEN_DOCUMENT with multiple selection and read-only persistable URI grants when Remember media is enabled. Permission records remain device-local and are not stored in .ordo project files. File bytes are read through Capacitor's content-URI route and verified with a full streaming SHA-256 fingerprint. Providers with temporary grants use the same local-copy fallback as web imports. Clearing remembered media releases read grants and removes the cache. Deleting/moving a file, revoking provider permission or clearing application data requires relinking. Cloud providers may need network access to supply their selected file. Real-provider permission retention across app restarts still needs phone verification.

Audio processing uses one AudioContext for preview and a continuous OfflineAudioContext for export, with gain, three EQ bands, pan, compressor, compressor-based limiter and a separate fader/envelope. Export suspends at one-second boundaries while fetching source audio windows so processing state does not reset at each block. The final stereo mix is retained in memory, up to about 46 MB at 120 seconds / stereo 48 kHz. The encoded output is also retained, so the existing export/save limits remain.

### Images and typography (v0.6.0)

The native picker includes images. JPEG, PNG, WebP, AVIF, BMP and GIF are decoded as stills when supported by the WebView; animated images use one still frame. All 66 title/caption fonts are bundled in the APK. No Google Fonts network access is needed.

On a phone, import a camera photo and a transparent PNG, extend/shorten them with the trim handles, apply a crop and adjustments, preview Start/End/Between transitions, then export. Reopen the saved project to verify remembered image-provider access. Confirm audio Fade in/out/Crossfade duration controls with an MP3.
