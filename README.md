# Ordo for Android

## v0.10.0

Select a video or audio clip, open Clip settings, then use Clip speed. Choose 0.25×, 0.5×, 1×, 1.5×, 2× or 4×, or enter a custom value in that range. Preserve pitch is on by default. Apply changes one clip or all clips of the same media kind. Ripple shifts following clips on the same track; switch it off to retain their positions, with overlaps blocked. Image and text clips use duration controls instead.

Speed changes retain the selected source In/Out, adjust timeline duration to whole 30 fps frames, and support preview, split, trim, undo/redo, saving and both export engines. Native video uses Media3 speed adjustment; both export paths share a local, streaming Signalsmith Stretch audio mix when preserving pitch. Slow motion repeats source frames, without frame interpolation. Extreme stretching can sound less natural. Speed projects save as format 6 so older Ordo versions reject them rather than silently dropping their speed edits; older projects remain supported.


App and Android version names now read from package.json automatically. The landing page includes current title controls, duration handles, native export and background-rendering details, with versioned stylesheet and APK links.

Titles and captions now have four corner handles to resize text, including after rotation. Drag either timeline edge to change their duration. Images show duration handles on both desktop and Android, without needing to select the image first. Changes remain undoable.

Native Android MP4/HEVC export now includes titles and captions, preserving the app fonts, placement, opacity and all title edge effects. Title images are prepared once; Android decodes and encodes the video without WebView frame seeking. A single combined GPU overlay supports sequential captions without consuming one texture unit per caption. The Media3 encoder already prefers hardware codecs when available; changing codecs alone does not remove the WebView bottleneck. H.264 is the default for compatibility; HEVC remains available for supported devices.

During native rendering, an Android foreground service shows progress and Cancel, holds a partial wake lock and continues when switching apps or turning off the screen. Allow notifications to see export progress. A completion notification returns to Ordo; choose the save location after returning. Keep Ordo open during audio/title preparation and compatible rendering. Force stopping Ordo, removing its task, or restarting the phone cancels the job; exports do not resume after process death. Picture transitions, grading, opacity and V2 overlays still use compatible rendering. No speed multiplier is claimed without testing the user's device and media.

A free, open-source video editor for Android. Edit video, images and sound on your device, with no account or media upload required. No AI features.

[Download Android APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Visit the website](https://averydimbulb79.github.io/Ordo/) · [Android guide](docs/ANDROID.md) · [Release history](docs/CHANGELOG.md)

| At a glance | Details |
| --- | --- |
| Current app | v0.10.0, development build |
| Platform | Android 7.0 or later; codec support varies by device |
| Website | Product information, Android screenshot with a release-synchronised version label and two-row toolbar, responsive layout and APK downloads |
| Privacy | Local editing and rendering; bundled offline fonts |
| Licence | MIT; dependency and font licences also apply |

### What you can do

| Tool | Available features |
| --- | --- |
| Media | Import video, audio and images; thumbnails, filenames and durations; Add all media |
| Timeline | V1/V2 picture tracks, A1/A2 audio tracks and T/C text lanes; trim, split, duplicate and reorder |
| Clip speed | 0.25×–4× video/audio speed, pitch preservation, same-track ripple and scoped Apply to all |
| Images | Six-second default; shorten or extend with normal trim controls; crop, grade, layer and export |
| Picture | Brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette and fade |
| Crop | Common aspect ratios, free sizing and an option to match the project canvas |
| Transitions | 13 effects plus None; Start/End clip animations and Between transitions on adjacent V1 clips; Apply to all |
| Titles and captions | 66 offline Google Fonts; size, colour, rotation, bold, italic, underline, strikethrough, positioning, outline and background |
| Subtitle files | Import SRT/VTT; export SRT |
| Audio | Volume, gain, pan, three-band EQ, compressor, limiter, fade in/out and A1/A2 crossfades; durations in seconds |
| Preview | Live adjustment panel, Adjusted comparison checkbox and fullscreen with sensor rotation on Android |
| Projects | Save .ordo files, Undo/Redo, recovery snapshots, remembered media and batch relinking |

### Install and start editing

1. Download the [latest APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) on your Android phone.
2. Open the downloaded file. If prompted, allow installation from the source you used to download it.
3. Import media, choose a destination track and tap Add to sequence, or use Add all media.
4. Select a clip to edit. Use the dedicated Transitions, Title, Captions, Adjust and Crop tools.
5. Save your .ordo project and retain the original media. Export when ready.

Updates use the same application ID and development signing certificate, with an increasing versionCode, so the APK can install over the existing app.

### Export options

| Setting | Choices |
| --- | --- |
| Format | MP4 H.264/AAC, MP4 H.265/AAC, WebM VP8/Opus |
| Resolution | 480p, 720p, 1080p, 2160p; preserves canvas orientation |
| Frame rate | 24, 25, 30, 50 or 60 FPS |
| Quality | Compact, Standard or High |

If frame decoding fails, export automatically retries through the same video playback decoder used by preview. Effects, transitions and mixed audio remain in the export. The status shows “Rendering with preview decoder” when recovery is active; unrecoverable errors identify the filename, timeline time and source time.

Available combinations depend on the device's encoders. The timeline runs at 30 FPS; higher export FPS does not create new motion in lower-frame-rate footage.

Delete and Undo sit beside Split in the mobile toolbar. Its 12 buttons are arranged in two rows of six. Select a clip and tap Delete; tap Undo to restore it.

### Current limits

| Area | Current behaviour |
| --- | --- |
| Export duration | No fixed export duration cap; available device memory and the 256 MB Android save limit still apply |
| Android save size | Up to 256 MB; final encoded output is assembled in memory |
| Exporting | Keep the app in the foreground; large resolutions and frame rates need more memory |
| Transitions | Start/End leave timing unchanged; Between overlaps V1 clips and shortens the sequence |
| Independent tracks | V2/A1/A2 keep explicit timing and gaps; A1/A2 allow controlled crossfade overlaps |
| Image formats | JPEG, PNG, WebP, AVIF, BMP and GIF where supported; animated images import as one still frame |
| Fonts | 66 bundled Latin families; other scripts use device fallback; missing bold/italic faces use synthesised styles |
| Project compatibility | Saves v5; opens v1–v4; older Ordo versions cannot open v5 files |
| Media relinking | Project files do not embed media. Moved files, revoked access or cleared app storage may require relinking |

### Save and reopen projects

- Save .ordo files separately from the original media. Both are needed to keep an editable project.
- Remember media on this device retains permitted Android file access, or local copies when a provider cannot retain access and storage allows.
- Locate missing media reconnects multiple files. Content fingerprints recognise renamed files and reject different files with matching names and sizes.
- Older projects may need one initial relink and a new save before automatic reconnection works.
- Forget remembered media removes stored references/copies and permissions while leaving the current edit open.

### Development

The product is Android-only. The browser-based editing engine remains in the repository for the Capacitor APK and automated development checks. GitHub Pages publishes only the separate landing page.

| Requirement | Version |
| --- | --- |
| Node.js | 22.12 or later |
| Java | JDK 21 for Android builds |
| Android SDK | 36 |
| Browser checks | Playwright Chromium and FFmpeg |

| Command | Purpose |
| --- | --- |
| `npm ci` | Install pinned dependencies |
| `npm run dev` | Run the internal editor development harness |
| `npm test` | Run component checks |
| `npm run build` | Build the Android editor assets into dist |
| `npm run android:sync` | Build the editor and sync Capacitor's Android project |
| `npm run android:open` | Open the native project in Android Studio |
| `npm run build:landing` | Build the public Android website into landing-dist |
| `npm run dev:landing` | Preview the landing page locally |

Browser suites: `test:browser`, `test:mobile`, `test:composition`, `test:creative`, `test:bulk`, `test:touch-preview`, `test:audio`, `test:images` and `test:export-duration`. Install Chromium with `npx playwright install chromium` before running them.

GitHub Actions builds the APK, checks the editor and deploys the landing page separately. [View build results](https://github.com/Averydimbulb79/Ordo/actions).

### Project links

| Reference | Contents |
| --- | --- |
| [Roadmap](docs/ROADMAP.md) | Planned features; development targets are not current capabilities |
| [Changelog](docs/CHANGELOG.md) | Release history |
| [Android guide](docs/ANDROID.md) | Current v0.9.0 usage, limits, native setup and phone checks |
| [Components](docs/COMPONENTS.md) | Editing engine and dependencies |
| [Validation](docs/VALIDATION.md) | Test coverage and limitations |
| [Fonts](docs/FONTS.md) | Font catalogue and style support |
| [Font licences](public/FONT-LICENSES.txt) | Bundled font terms |
| [Third-party licences](public/THIRD-PARTY-LICENSES.txt) | Additional dependency terms |

Keep rollback checkpoints before substantial changes and update this README with each release.

### v0.7.0 export improvements

| Change | Behaviour |
| --- | --- |
| Faster compatible export | Hardware encoding preference with software fallback; direct frame rendering when safe; one-second audio encoding batches; four-second audio decode windows |
| Native Android video | Media3 surface-based decode, crop, resize, scale, positioning and encoding for eligible MP4 timelines; JPEG/PNG stills and trimmed video |
| Audio parity | The existing offline mix preserves all audio tracks, fades, EQ and dynamics; native video uses a temporary stereo PCM WAV |
| Automatic routing | Picture transitions, picture overlays, non-default picture opacity, colour adjustments and unsupported still formats retain the compatible compositor; titles and captions now use native overlays |
| Smaller files | At 720p30: Compact 1.2 Mbps, Standard 2 Mbps, High 4 Mbps; estimates appear before rendering |
| Native saving | Completed native output streams to the chosen Android document without a full video Blob or base64 transfer |

Native codec failure retries the compatible exporter. Save failures do not rerender automatically. Native video is not full compositor parity yet, and speed on a particular phone remains to be measured. Both paths keep processing local.

### v0.8.0 text controls and export recovery

| Feature | Behaviour |
| --- | --- |
| Titles/captions | Tap in Program or on the timeline to edit; drag text to move it, use the round handle to rotate, then Apply; Cancel restores |
| Text timing | Drag title/caption timeline clips sideways to change start time |
| Text animation | Independent Start/End transitions from the 13-effect catalogue, with durations |
| Opacity | 0–100% for text, video and images; picture Adjust also supports bulk opacity |
| Source volume | Clip properties supports live volume and Apply to all video/audio clips separately; existing EQ/fades remain intact |
| Video soundtrack | Source audio adjustments exposes gain, EQ, pan, dynamics and fades for original video sound |
| Frame recovery | Android native frame extraction retries preview-decoder stalls inside the shared compositor, retaining titles, transitions, opacity, grading and sound |
| Source access | Sources lacking native URI access are staged in bounded chunks and cleaned up after recovery; cache storage is required |

Native frame recovery prioritises completing the edit and may be slower than whole-video native export. The user's original video has not been reproduced locally; a phone trial remains necessary.

On each Android app launch, Ordo checks the public release manifest for a newer build. The optional Download update prompt opens the official APK; Later dismisses it for that launch. Checks fail silently offline and never upload project/media data. Install this release once to receive future prompts; older APKs cannot gain the check without an update.
