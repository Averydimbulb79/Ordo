# Ordo roadmap: Android first

Updated 24 October 2026. Product target: a capable Android editor comparable to the traditional, non-AI editing workflows of Filmora Mobile and CapCut. This is the development goal, not a claim about current parity.

The Android app uses a browser-based engine internally through Capacitor. The browser editor is a development harness, not a separately distributed product. GitHub hosts source, rollback checkpoints, build checks, the Android landing page and APK builds. Windows work is deferred. No AI features, accounts or cloud processing are planned for the initial product.

## Feature targets

| Category | Target features | Planned milestone |
| --- | --- | --- |
| Editing | Split, trim, delete, duplicate, reorder, undo/redo, snapping, touch gestures, filmstrip thumbnails | 0.2–0.3 |
| Timeline | Main video, overlapping video/image overlays, independent audio tracks, linked/unlinked audio, lock/mute/hide, zoom | 0.3 |
| Canvas | Landscape/portrait/square presets, crop, rotate, flip, fit/fill, background colour or blur | 0.3 |
| Timing | Constant speed, freeze frames, reverse, custom speed curves, pitch-preserving audio where feasible | 0.4 |
| Animation | Transform/opacity/volume keyframes, easing, curve editor, entrance/exit presets | 0.4 |
| Titles | Text styles, fonts, outlines, shadows, tracking/leading, manual captions, SRT/VTT import/export | 0.5 |
| Creative assets | Original/licensed stickers, shapes, reusable layouts, transitions and templates | 0.5 |
| Compositing | Picture-in-picture, masks and feathering, blend modes, chroma key with spill adjustment | 0.6 |
| Colour/effects | Exposure, contrast, temperature, HSL, curves, LUT import, filters, non-AI effects | 0.6 |
| Audio | Voiceover, extraction, fades, mixing, EQ, compression, manual ducking and beat markers | 0.7 |
| Delivery | 1080p and hardware-supported 4K, supported frame rates/bitrates, MP4 export, share/gallery integration, cancellation | Incremental after device benchmarks |
| Reliability | Autosave, relinking, app-owned media copies, project collection, recovery, bounded caches and low-memory handling | Every milestone |

Published reference material describes keyframes, speed curves, chroma key and overlays. Availability differs between products/platforms/versions. We will compare actual user workflows and define acceptance checks for each feature rather than copy marketing counts.

References inspected:
- https://www.capcut.com/resource/how-to-use-capcut
- https://www.capcut.com/resource/how-to-do-velocity-on-capcut
- https://filmora.wondershare.com/guide-mobile/advanced-editing.html
- https://support.wondershare.com/how-tos/filmora-for-mobile/how-to-add-keyframe-in-mobile.html
- https://support.wondershare.com/how-tos/filmora-for-mobile/how-to-edit-pip-in-mobile.html

## 0.1: completed web assembly baseline

Single sequential track, split/trim/reorder, preview, undo/redo, clip volume, .ordo save/reopen/relink, recovery snapshots and short export. Fixed 720p/30 fps and two-minute export cap. Browser tests passed; this does not establish Android compatibility.

## 0.2: Android foundation

Capacitor wrapper, native file saving, system bar accommodation, touch-focused workspace, bottom tool dock, panel sheets, pinch/pan/scrub/trim, duplicate, stable test signing and GitHub APK distribution. Preserve the original editor on backup/v0.1.0-before-android.

Acceptance: build APK and lint; keep web editing tests passing; validate mobile gestures in a touch browser; then test import, playback, project reopening and audiovisual export on an actual phone. Distinguish build success from a verified device workflow.

## 0.3: useful mobile multitrack editor

0.3.0 delivers video media-card thumbnails/duration/filename, a four-track baseline (V1, V2, A1, A2), independent placement, picture-in-picture transforms and cross-dissolves on V1 with sound crossfades. Preview and export share composition rules; older projects migrate to format v2. Keyframe automation is not implemented yet.

Remaining in the 0.3 series: additional overlay and soundtrack tracks, photo import, aspect ratio presets, timeline filmstrips, snapping and direct preview transforms. Preview and export must use the same timeline/composition rules. Add project media collection so ongoing edits do not rely only on transient file access.

## 0.4.0: creative and delivery tools delivered

Dedicated panels now implement 13 transitions, styled titles/manual captions with 10 offline Google Fonts, SRT/VTT import/SRT export, 11 grading controls, ratio/free crop and selectable output resolution/FPS/quality. Project v3 persists these settings and reads v1/v2 files. This release does not implement keyframe animation or speed controls. Source/frame memory and real-phone performance remain areas for further work.

## Next: timing and animation

Speed/freeze/reverse, keyframes and easing. Diamond-shaped keyframes will animate position, scale, opacity and volume, with add/remove, previous/next and easing controls; preview and export must evaluate the same values. Keep clip duration, audio sync and undo correct when retiming. Variable speed follows constant-speed validation.

## 0.5: text, captions and templates

Manual text/captions, shapes, original/licensed assets and reusable templates. No auto-transcription, generative assets or AI templates.

## 0.6: finishing and compositing

Masks, chroma key, blend modes, transitions, colour controls and LUTs. Verify exported pixels and avoid UI controls that have no rendering implementation.

## 0.7: audio and production readiness

Voiceover, mixer, effects and manual beat tools, plus export choices supported by device testing. Increase duration/resolution only when resource use and output reliability justify it.

## Out of scope

AI generation, AI object/background removal, speech recognition/automatic captions, voice cloning, generative music, automatic reframing or AI enhancement. Conventional GPU acceleration, chroma key, manually placed masks and manual captions remain in scope. Proprietary templates/music/assets are not included without rights.

## Release discipline

Work on main with rollback checkpoints before substantial changes. Keep README concise and current. Retain stable app ID and test signing certificate for install-over updates. Apply an increasing Android versionCode. Run model, project, browser, touch and Android build checks appropriate to each change. Never equate a feature list or a successful build with Filmora/CapCut-level reliability.

## Shipped in v0.5.0

Remembered Android media permissions/local web cache, streaming content fingerprints, batch relinking, selection-aware audio adjustment panel, volume/gain/pan/EQ/compression/limiting, per-clip fades, equal-power A1/A2 crossfades and first/last track fades. Preview and export share the processing chain; project format v4 preserves audio edits and media fingerprints. Native provider behavior across restarts remains a device validation task.

## Shipped in v0.6.0

- Six-second image clips with flexible duration, crop, grading, layering and export.
- Start/End/Between transition categories and bulk application.
- Per-clip audio fade in/out alongside crossfades and track-edge shortcuts.
- 66 offline font families for titles and captions.

## v0.7.0 native export scope

Media3 native MP4 rendering supports sequential video and JPEG/PNG stills with clipping, crop, fit, scale and placement. The offline audio mixer preserves existing audio edits. Native visual parity for colour grading, animated transitions, titles/captions, opacity and V2 overlays remains future work; these use the compatible exporter. Benchmark on real phones before claiming a speed multiplier.
