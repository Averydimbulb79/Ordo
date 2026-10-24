# Ordo Android guide

Current release: v0.10.0 · Development build · Updated 24 October 2026.

[Download APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Website](https://averydimbulb79.github.io/Ordo/) · [README](../README.md) · [Changelog](CHANGELOG.md)

### Install and update

| Item | Details |
| --- | --- |
| Requirements | Android 7.0 / API 24 or later. Playback and export depend on Android System WebView and the device's codecs |
| Installation | Download the APK, open it and allow installation from that browser/file manager if prompted |
| Updates | Install newer APKs over the existing app. Published builds retain the same application ID and signing certificate, with an increasing build number |
| Startup check | Each launch checks for a newer build. Download update opens the official APK; Later dismisses the prompt for that launch. Checks fail silently offline |
| Offline use | Editor assets, fonts and pitch processing are bundled. Cloud-provider media may need a connection to download; editing does not require an account or media upload |

The visible version and internal build number are separate. Save projects and keep original media backed up before updating; uninstalling or clearing app data can remove local recovery and remembered media.

### Start an edit

1. Open Media and import video, images or audio.
2. Choose destination tracks, then tap Add to sequence or Add all media.
3. Select a clip. Open Edit for source In/Out, track placement, speed and source volume.
4. Use Transitions, Title, Captions, Adjust or Crop for the relevant tool. Apply commits changes; Cancel restores the previous settings.
5. Save an .ordo project through Project. Retain its original media files.
6. Open Export, choose settings and render. Choose the save destination when prompted.

Bulk insertion and Apply to all each create one undoable step. Delete and Undo sit beside Split in the mobile toolbar, arranged in two rows of six.

### Timeline and clip controls

| Lane | Purpose and timing |
| --- | --- |
| V1 | Main picture assembly. Adjacent clips normally follow one another; Between joins overlap them. Speed edits without ripple can retain gaps |
| V2 | Video/image overlays with explicit start times and gaps; no same-lane overlap |
| A1 / A2 | Independent audio with explicit timing and gaps; controlled crossfade overlaps |
| T / C | Timed titles and captions |

The editing timeline runs at 30 FPS, independently of export FPS. New V2/A1/A2 clips append at that lane's end or the playhead, whichever is later. Pan horizontally/vertically and pinch to zoom.

| Action | Control |
| --- | --- |
| Select, split or remove | Select a clip, then use Split or Delete. Undo restores the previous edit |
| Trim video/audio | Drag trim handles or set source In/Out in Edit |
| Extend an image | Drag either duration handle or use In/Out. Images start at six seconds and can be extended |
| Reorder V1 | Drag a clip to another V1 clip. Use Edit for independent-track placement |
| Move text in time | Drag its timeline clip horizontally |
| Change text duration | Drag either edge of its timeline clip |

JPEG, PNG, WebP, AVIF, BMP and GIF import where decoding is supported. Animated formats import as one still frame. Transparent images retain transparency through compatible composition and export.

### Clip speed

Select a video or audio clip → Edit → Clip speed. Images and text use duration controls instead.

| Control | Behaviour |
| --- | --- |
| Presets / Custom | 0.25×, 0.5×, 1×, 1.5×, 2× or 4×; custom values within 0.25×–4× |
| Preserve original pitch | On by default. Retains voice/music pitch while changing duration; disabling it shifts pitch with speed |
| Ripple following clips | Shifts later clips on the same track. Other tracks and text keep their timing |
| Ripple off | Retains following clips' positions, leaving gaps when needed. Changes causing overlaps or invalid crossfades are rejected |
| Apply speed | Updates one clip. Apply to all targets video or imported audio separately |

Speed retains the selected source In/Out and rounds timeline duration to whole frames. Preview, split, trim, undo/redo and both export paths use the retimed source. Slow motion repeats source frames; no motion interpolation is added. Extreme stretching can sound less natural.

### Picture, titles and preview

| Tool | Available controls |
| --- | --- |
| Picture Adjust | Brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette, fade and opacity; bulk application |
| Crop / placement | Common aspect-ratio presets, free sizing, numeric coordinates, canvas matching, position and scale |
| Titles / captions | Tap text in Program or on its timeline clip. Drag to move, use a corner to resize or the round handle to rotate; Apply to commit |
| Text styling | 66 bundled Google Fonts, colour, alignment, bold/italic, underline, strikethrough, outline, background, opacity and Start/End animations |
| Subtitle files | Import SRT/VTT and export SRT. Styled text is rendered into the video export |
| Adjusted comparison | Bypasses picture grading and audio processing in preview. Volume, fades, crossfades, crop, text, placement and timing remain active; export retains committed settings |
| Fullscreen | Expands the player with transport and scrubbing. Android sensor rotation is restored on exit |

Adjustment panels keep the preview accessible. Swipe vertically to scroll; drag sideways deliberately to move a slider. Android Back exits fullscreen first, then closes the active panel before offering to exit. Normal preview playback pauses when the app becomes hidden.

Bundled fonts cover Latin text. Other scripts use device fallback; unavailable bold/italic faces are synthesised. See the [font catalogue](FONTS.md).

### Sound and transitions

Original video sound and imported audio each have volume controls in Edit, with separate Apply to all scopes. Source audio adjustments opens gain, pan, EQ, compressor, limiter and fades for video sound too. Adjust automatically opens audio controls for audio clips and A1/A2 selections.

| Transition | Applies to | Timing |
| --- | --- | --- |
| Picture Start / End | V1/V2 video and images | 0.1–10 seconds, clamped to clip length; does not move the clip or change its sound |
| Picture Between | Adjacent V1 picture clips | 0.1–2 seconds, clamped to half of either clip; overlaps pictures and crossfades sound, shortening the assembly |
| Text Start / End | Titles and captions, in the text tool | Independent effect and duration controls; clamped to text length |
| Audio Fade in / out | Selected or bulk audio clips | Duration in seconds; zero removes the fade. First/last shortcuts are available |
| Audio Crossfade | Adjacent A1/A2 clips | Equal-power blending; 0.1–10 seconds, clamped to half of either clip. Existing gaps are retained |

The 13 picture/text effects are Cross dissolve, Fade through black/white, Wipe left/right/up/down, Slide left/right, Push left/right and Zoom in/out. None removes the selected transition. With an audio clip selected, Transitions opens audio fades and crossfades.

### Export and background rendering

| Setting | Choices |
| --- | --- |
| Format | MP4 H.264/AAC, MP4 H.265 (HEVC)/AAC, WebM VP8/Opus |
| Resolution | 480p, 720p, 1080p or 2160p; preserves canvas orientation |
| Frame rate | 24, 25, 30, 50 or 60 FPS |
| Quality | Compact, Standard or High; estimated size shown before export |

Available codecs, resolution and acceleration depend on the phone. Higher FPS does not create new motion in lower-rate footage. At 720p30, Compact/Standard/High target 1.2/2/4 Mbps video; a four-minute Standard export is approximately 64 MB including audio, depending on the encoder.

| Export path | Supported work and behaviour |
| --- | --- |
| Native MP4 | Eligible contiguous V1 video/JPEG/PNG timelines, trim, crop, fit, scale, placement, speed, titles and captions, including text opacity and animations. Media3 handles video; the shared audio mix retains sound edits |
| Compatible | WebM, picture transitions, grading, picture opacity, V2 overlays, gaps, unsupported native media and audio/text extending beyond the picture. Retains edits through the shared compositor |
| Routing / recovery | The dialog explains the selected path. Native codec failure can retry compatible export. Decoder stalls can retry preview or Android frame recovery; recovery can be slower |

To export while using another app:

1. Allow notifications when asked, then start export.
2. Keep Ordo open during audio/title preparation.
3. Once the status shows Native Android rendering, switch apps or turn off the screen. The notification provides progress and Cancel.
4. Return through the completion notification and choose where to save the video.

Compatible rendering requires Ordo in the foreground. Force-closing, removing the app's task, process termination or restarting the phone stops export; interrupted jobs do not resume automatically. Native save failures do not automatically rerender the video.

### Limits and troubleshooting

| Issue or limit | Guidance |
| --- | --- |
| Duration / timeline | No fixed app export-duration cap; timeline maximum is 24 hours. Actual capacity depends on memory, storage and Android service limits |
| Compatible save size | Up to 256 MB on Android, with conservative estimated-size checks. Lower resolution/quality or shorten the edit if blocked |
| Native save size | Encoded video streams from cache to the chosen document; the compatible-path 256 MB limit does not apply |
| Memory / cache | Both paths retain the stereo audio mix; compatible rendering also retains encoded output. Native temporary PCM uses about 11.5 MB/minute plus video cache storage |
| Unsupported settings | Try H.264, lower resolution or lower FPS. H.265 and 4K are device-dependent |
| Slow export | Check the selected path. Edits requiring compatible composition and decoder recovery can be slower than native rendering; speed varies by phone and source |
| Decoder error | Errors identify the file and timeline/source time. Relink the original source and retry supported settings if automatic recovery fails |
| Missing media | Use Locate missing media for a batch, or Relink for one asset. Cloud providers may need a connection to fetch the source |

### Save, reopen and relink

| Action | Behaviour |
| --- | --- |
| Save project | Writes editing data to .ordo; media, thumbnails and Android content URIs are not embedded |
| Remember media | Retains permitted Android read access, or local copies when persistent provider access is unavailable and storage allows |
| Open / recover | Attempts automatic reconnection to remembered assets |
| Locate missing media | Full SHA-256 fingerprints reconnect renamed originals and reject different content with matching names/sizes |
| Forget remembered media | Removes remembered references/copies and releases read grants; the current edit stays open |

Current Ordo opens project formats v1–v6. New projects use v5; applying speed upgrades them to v6, which requires v0.10.0 or later. Earlier projects may need an initial relink and a new save before automatic reconnection works.

Moving/deleting sources, revoking access or clearing app data can require relinking again. Remembered media and recovery do not replace backups of both your .ordo files and original media. Cancelling project Save as keeps unsaved edits open.

### Build locally

| Requirement | Version |
| --- | --- |
| Node.js | 22.12+ |
| Java | JDK 21 |
| Android SDK | Compile/target 36; minimum 24 |
| Capacitor | 8.5.3 |

From the repository root in a Unix-like shell:

```sh
npm ci
npm run android:sync
base64 --decode .github/development-signing.p12.base64 > .github/development-signing.p12
cd android
chmod +x gradlew
./gradlew testDebugUnitTest assembleDebug lintDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Set `ORDO_VERSION_CODE` higher than the installed build for a local update; retain application ID `sg.kithandkeen.ordo` and the signing certificate. The repository's public development certificate is for test APKs; production distribution needs private signing credentials.

| Component | Role |
| --- | --- |
| Capacitor / Android bridge | App shell, system integration, file access and Save as |
| Media3 Transformer 1.10.1 | Native video decoding, effects, retiming and encoding |
| Mediabunny / WebCodecs | Compatible import, decoding and encoding |
| Canvas / WebGL / CPU | Shared composition, picture adjustments, text and transitions |
| Web Audio / Signalsmith Stretch | Audio processing, continuous mixing and local pitch-preserving retiming |
| ImageBitmap | Still-image decoding with inactive-image cleanup |

The internal browser harness builds into dist for the APK; landing-dist contains only the public website. App labels, Android versionName and website release labels read the package.json version. GitHub Actions checks, builds and publishes the APK and deploys the landing page separately.

See [Validation](VALIDATION.md) for automated coverage, [Components](COMPONENTS.md) for engine details and the [Roadmap](ROADMAP.md) for planned features. Keyframes, speed ramps, masks, chroma key and additional tracks remain planned work. Automated checks do not certify every phone, provider, codec or memory limit.
