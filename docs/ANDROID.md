## Ordo for Android · v0.8.0

Current app release: v0.8.0, development build. Guide updated 24 October 2026.

[Download the latest APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Ordo website](https://averydimbulb79.github.io/Ordo/) · [Release history](CHANGELOG.md) · [Roadmap](ROADMAP.md)

### New in v0.8.0

- Check for a newer build each app launch, using the official public release manifest. Download update opens the official APK; Later dismisses the prompt for that launch. Offline checks are silent. Install v0.8.0 manually once to enable future prompts.

- Tap a title/caption in Program or its timeline clip. Drag the text to reposition it, use the round handle to rotate, and press Apply. Cancel restores the original values. Preview remains accessible while editing.
- Drag title/caption clips horizontally on the timeline to change their start time.
- Text tools include opacity and independent Start/End transitions with durations. Preview/export share the same rendering.
- Picture Adjust includes opacity and bulk application. Original source volume in Clip properties has separate bulk scopes for video and imported audio. Source audio adjustments also works with video soundtracks.
- If the preview decoder times out, native Android frame extraction supplies the requested picture to the shared compositor. This works for projects with text/effects that cannot use whole-video native export.
- Recovery stages sources into temporary cache if native URI access is unavailable. Staging is chunked and cleaned up after completion/cancellation. This can be slower and requires cache storage; effects and sound are retained.

### New in v0.7.0

- Automatically choose Media3 native video export for eligible MP4 projects: cuts, trims, JPEG/PNG stills, crop, resize, scale and positioning.
- Native video uses Android media codecs and OpenGL rather than WebView frame seeking. Device hardware support determines available acceleration. The FPS setting caps native video frame rate; lower-rate source video is not upsampled.
- Keep all audio edits through the existing offline mixer and stage its stereo PCM output for native AAC encoding.
- Retain the compatible exporter for transitions, titles/captions, colour adjustments, opacity, picture overlays, unsupported still formats and audio extending beyond the picture. The export dialog explains routing. Native codec failures retry compatible export.
- Reduce compatible frame copying, prefer supported hardware encoding, submit audio in one-second chunks and decode audio in four-second windows.
- Reduce 720p30 video bitrates to 1.2 / 2 / 4 Mbps for Compact / Standard / High. A four-minute Standard export targets approximately 64 MB including audio. Estimates vary with encoder behaviour.
- Stream native output directly to your chosen file; temporary video/audio files are removed after saving, cancellation or failure.

### Requirements and distribution

| Item | Current behaviour |
| --- | --- |
| Android version | Android 7.0 / API 24 or later at the application-shell level |
| Playback and encoding | Depend on Android System WebView, the device and its codecs; meeting the minimum Android version does not guarantee every editing/export combination |
| Distribution | APK development build, available from the link above |
| Public website | Android product information and APK downloads; no public browser editor |
| Account | Not required |
| Media processing | Local editing and rendering; no media upload required |
| Offline use | Fonts and editor assets are bundled; a selected cloud-provider file may still require a connection to download its contents |

### Install and update

1. Download the APK on your Android phone and open the downloaded file.
2. If Android asks, allow installation from the browser or file manager used to open it.
3. Install and launch Ordo. Keep your original media and saved projects backed up while using this development build.
4. For future updates, install the newer APK over the existing app rather than uninstalling first.

Published APKs retain the same application ID, `sg.kithandkeen.ordo`, and development signing certificate. GitHub assigns an increasing versionCode so newer builds can update the installed app. The visible release version and the internal build number are separate; several builds can share the v0.7.0 label.

### What is available in v0.8.0

| Area | Available tools |
| --- | --- |
| Import | Video, audio and images; reading/result feedback; thumbnails, filenames and durations; Add all media |
| Editing | Touch trim handles, In/Out frame controls, split, duplicate, reorder, track placement, position, scale and opacity |
| Timeline | Six visible lanes: V1, V2, A1, A2, T and C; horizontal/vertical panning and pinch zoom |
| Images | Six-second default duration; normal trimming to shorten or extend; crop, picture adjustments, transitions, layering and export |
| Picture adjustments | Brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette and fade |
| Crop | Original, 16:9, 9:16, 1:1, 4:3, 3:4, 4:5 and 21:9; free sizing, corner dragging and numeric coordinates; optional canvas matching |
| Transitions | Start, End and Between categories; 13 effects plus None; duration controls and Apply to all |
| Titles and captions | 66 bundled Google Fonts; size, colour, rotation, bold, italic, underline, strikethrough, alignment, position, outline and background |
| Subtitle files | Import SRT or VTT; export SRT; styled text is rendered into the exported video |
| Audio adjustments | Volume, gain, pan, three-band EQ, compressor, compressor-based limiter and per-clip fades |
| Audio transitions | Fade in, Fade out and Crossfade with durations in seconds; bulk application and first/last clip fade shortcuts |
| Preview | Live adjustment panel, Adjusted comparison checkbox and fullscreen playback with sensor rotation |
| Projects | Save/open .ordo files, Undo/Redo, local recovery, remembered media and batch relinking |

The app includes no AI features. Keyframes, retiming, masks, chroma key and additional tracks remain roadmap work, not current capabilities. Filmora/CapCut-level editing is a development target rather than a claim of present feature parity.

### Start an edit

1. Tap Media and import your video, images or audio. The media panel shows reading feedback and the imported assets.
2. Choose a destination on each media card, then tap Add to sequence. Add all media inserts the available assets in bin order, using the selected picture and audio destinations.
3. Select a timeline clip. Use Edit for its source range, track/start time and placement, or drag a trim handle to change its length.
4. Use Transitions, Title, Captions, Crop or Adjust for the relevant tool. Apply commits panel changes; Cancel restores the previous settings.
5. Save an .ordo project through Project. Keep the original media alongside your project backup.
6. Export, choose the output settings and select the save destination through Android's Save as dialog.

Bulk insertion and Apply to all edits each create one undoable history step. Missing media is skipped during Add all media, with feedback.

### Timeline and clip behaviour

| Lane | Purpose and timing |
| --- | --- |
| V1 | Main picture assembly; video and image clips follow one another. Trimming closes the gap; Between transitions overlap adjacent clips |
| V2 | Video/image overlay, initially placed as picture-in-picture; explicit start times and gaps; no same-lane clip overlap |
| A1 / A2 | Independent audio placement with explicit start times and gaps; controlled overlaps are allowed for crossfades |
| T | Timed titles |
| C | Timed captions |

New V2/A1/A2 clips append at that lane's end or the playhead, whichever is later. Placement controls can change their start time. The timeline operates at 30 FPS, independently of the selected export FPS.

Image clips start at 6 seconds, not a fixed maximum. Extend or shorten them with the same trim handles and In/Out controls used for video. JPEG, PNG, WebP, AVIF, BMP and GIF are supported where the device can decode them; animated image formats import as one still frame. Transparent images retain their transparency through picture adjustments and export.

### Transitions

| Category | Applies to | Duration and timing |
| --- | --- | --- |
| Start | Beginning of a picture clip on V1 or V2 | 0.1–10 seconds, clamped to the clip's length; does not move the clip or change its sound |
| End | End of a picture clip on V1 or V2 | 0.1–10 seconds, clamped to the clip's length; does not move the clip or change its sound |
| Between | Adjacent picture clips on V1 | 0.1–2 seconds, clamped to half of either clip; overlaps the clips, shortens the assembly and crossfades their sound |

Picture effects are Cross dissolve, Fade through black, Fade through white, Wipe left/right/up/down, Slide left/right, Push left/right and Zoom in/out. None removes the selected transition. Apply to all targets picture clips for Start/End, or joins for Between.

With an audio clip selected, Transitions opens the audio controls:

| Audio transition | Behaviour |
| --- | --- |
| Fade in | Set seconds for the selected audio clip or all audio clips; zero removes the fade |
| Fade out | Set seconds for the selected audio clip or all audio clips; zero removes the fade |
| Crossfade | Overlap touching clips on A1 or A2, using equal-power blending; 0.1–10 seconds, clamped to half of either clip |
| First/last shortcuts | Fade in the first clip and fade out the last clip on the chosen audio lane, including lanes with gaps |

Crossfades can apply to all adjacent joins. Existing gaps are retained, and video timing remains unchanged. Short clips clamp fade durations to their own length.

### Adjustments, text and preview

- Selecting an MP3/audio clip or a clip on A1/A2 switches Adjust to audio controls. Selecting a picture clip on V1/V2 opens picture controls.
- The compact adjustment panel leaves the player visible. Swipe vertically to scroll; drag deliberately sideways to adjust a slider without accidental tap jumps.
- Adjusted checked shows picture grading and audio processing. Unchecking bypasses those preview effects; clip volume, fades, crossfades, crop, text, placement and timing stay active. Exports retain the committed settings.
- Titles and captions share all 66 bundled font families and work offline. The bundled fonts cover Latin text; other scripts use device fallback. Where a family has no native bold/italic face, the browser synthesises the style. See the [font catalogue](FONTS.md).
- The bottom-right fullscreen button expands the player with transport, scrubbing and Adjusted controls. Android hides system bars and enables full sensor rotation, then restores the earlier state on exit. Multi-window/device policies can affect orientation behaviour.
- Android Back exits fullscreen first, then closes the active panel/sheet before offering to exit the app. Playback pauses when the app becomes hidden.

### Export options and current limits

| Setting | Available choices |
| --- | --- |
| Format | MP4 H.264/AAC; MP4 H.265 (HEVC)/AAC; WebM VP8/Opus |
| Resolution | 480p, 720p, 1080p or 2160p; the selected short-edge size preserves canvas orientation |
| Frame rate | 24, 25, 30, 50 or 60 FPS |
| Quality | Compact, Standard or High |
| Export duration | No fixed duration cap; compatible output has a 256 MB save limit, native output streams to the selected document; device memory/storage limits still apply |
| Android save size | Up to 256 MB |
| Timeline length | Up to 24 hours; actual export capacity depends on memory and output file size |

The app checks encoder support for the chosen format, dimensions, frame rate and bitrate. H.265 and 4K are device-dependent options, not guaranteed capabilities of every phone. Unsupported combinations are blocked rather than silently replaced with another codec.

Higher output FPS does not invent motion in lower-frame-rate source footage. Compatible export retains encoded output and the final stereo audio mix in memory. Native export retains the audio mix in memory but writes encoded video to a cache file and streams it when saving. Temporary audio is stereo 48 kHz, 16-bit PCM, about 11.5 MB per minute; sufficient cache storage is required. Keep Ordo in the foreground during export; it keeps the screen awake while exporting.

Android Save as writes in checked chunks and validates the size before reporting success. Cancelling project Save as keeps unsaved edits open. The earlier false “Invalid file name or file exceeds…” rejection was fixed; the actual save-size limit remains.

### Save, reopen and relink

Project format v5 stores clip placement, image clips, picture/audio settings, crop, Start/End/Between transitions, text, canvas dimensions and source fingerprints. It opens v1–v4 projects and writes v5 when saved. Older Ordo releases cannot open v5 saves.

| Action | What happens |
| --- | --- |
| Save project | Writes an .ordo file containing editing data; media, thumbnails and Android content URIs are not embedded |
| Remember media on this device | Retains permitted Android read access; providers without persistent access use local copies when storage allows |
| Open a project / restore recovery | Attempts to reconnect remembered assets automatically |
| Locate missing media | Select multiple originals together; full SHA-256 fingerprints match renamed files and reject different content with the same name/size |
| Individual Relink | Reconnects a specific missing asset; needed for ambiguous legacy matches |
| Forget remembered media | Removes remembered references/copies and releases retained Android read grants; the current edit remains open |

Older projects may need one initial relink/import and a new save before automatic reconnection works. Moving or deleting sources, revoking provider access or clearing app data can require relinking again. Remembered media and recovery are conveniences, not substitutes for project and source-file backups.

### Check on your phone

1. Confirm the header and tool dock remain outside the Android status/navigation bars in portrait and landscape.
2. Import a phone video, an MP3, a camera photo and a transparent PNG. Check media feedback, thumbnails, filenames, durations and Add all media.
3. Add an image and confirm its six-second default. Extend it beyond six seconds, shorten it, split/duplicate it and undo.
4. Select a clip and tap Delete beside Split in the main toolbar; tap Undo on the toolbar to restore it. Place clips on V1/V2 and audio on A1/A2. Pan and pinch the timeline; check placement, gaps and picture-in-picture preview.
5. Try a crop preset and free sizing. Apply picture adjustments to video and images, including a transparent overlay; compare using Adjusted during playback.
6. Try Start/End animations and a Between join, including Apply to all. Confirm their different timing behaviour.
7. Select the MP3 and confirm Adjust opens audio controls. Check volume, pan/EQ, per-clip Fade in/out, first/last fades and an adjacent audio Crossfade.
8. Add a title and caption using different bundled fonts and styles. Import SRT/VTT if used in your workflow.
9. Enter fullscreen, rotate the phone and exit using Android Back. Check restored orientation, bars and edit state.
10. Save a project, cancel Save as once, then reopen after an app restart. Verify remembered media and test batch relinking when needed.
11. Export both a short sequence and an edit longer than two minutes using supported settings and play the result in another player. Check picture, text, transparency, fades and sound; test H.265 only where offered as supported.
12. Install a later published APK over the existing app without uninstalling and confirm your local recovery remains available.

Automated checks are described in [Validation](VALIDATION.md). They do not certify every phone, file provider, hardware codec, memory limit or orientation policy. Provider permission retention across restarts and high-resolution exports need real-device verification.

### Build and architecture

| Requirement | Version |
| --- | --- |
| Node.js | 22.12 or later |
| Java | JDK 21 |
| Android SDK platform / compile / target | 36 |
| Minimum Android SDK | 24 |
| Capacitor | 8.5.3 |

From the repository root, using a Unix-like shell:

```sh
npm ci
npm run android:sync
base64 --decode .github/development-signing.p12.base64 > .github/development-signing.p12
cd android
chmod +x gradlew
./gradlew testDebugUnitTest assembleDebug lintDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub's Android workflow performs the native tests, APK build and lint, then publishes the stable download. `ORDO_VERSION_CODE` supplies the increasing build number; a locally built update must use a number higher than the installed APK if updating over it. Keep the application ID and signing certificate stable.

The repository's development signing certificate is intentionally public and intended only for test APKs. Production distribution requires private signing credentials and a separate release process.

| Component | Role |
| --- | --- |
| Capacitor and the Android bridge | Bundled app shell, system-bar handling, file picking, remembered read access and chunked Save as |
| Mediabunny / WebCodecs | Video/audio import, decoding and encoding where supported |
| Canvas compositor | Shared preview/export placement, crop, transitions, titles and captions |
| Conventional WebGL / CPU processing | Picture adjustments; no AI |
| Web Audio | Preview processing and continuous export mixing with filter/compressor state retained across decoding windows |
| ImageBitmap | Still-image decoding; inactive photos are released rather than retained throughout playback/export |

The browser-based engine is an internal development/test harness and the APK's editing engine. It is not a separately published web app. `dist` supplies the Android editor; `landing-dist` supplies only the public marketing website.

The OrdoExport Capacitor plugin integrates Media3 Transformer 1.10.1 for eligible timelines. Native video effects currently cover crop, fit, scale and positioning. The shared compositor handles other visual edits; see [Components](COMPONENTS.md) and the [Roadmap](ROADMAP.md).
