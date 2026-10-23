# Validation: v0.1.0

22 October 2026.

## Automated core checks

Media metadata and invalid-input handling; split source continuity and duration preservation; trim bounds; undo/redo; project round trip; invalid projects, missing sources and duplicate IDs. TypeScript checks and production build.

## Browser workflow

Tested in headless Chromium using generated VP8/Opus footage with picture and a sine tone:

- Application boot, import, add to timeline, select, seek, split, trim, undo and redo.
- Save .ordo, reopen in a fresh browser context and relink original media.
- Playback, including progression across a split; deletion and undo.
- WebM export with progress, video and audio tracks, and cancellation.
- A 65-frame edit exports as 65 decodable video frames at 1280 × 720; output contains 48 kHz Opus audio. FFmpeg decodes the complete output without errors. Container duration can include audio-codec padding.
- 390-pixel viewport: no horizontal page overflow. Desktop and compact layouts inspected visually.
- No uncaught browser page errors in the workflow.

The reproducible test is scripts/browser-smoke.mjs, run by npm run test:browser. It requires ffmpeg and a Playwright browser, or CHROMIUM_PATH pointing to an existing Chromium executable.

## Limits of verification

The synthetic test is not a codec/device compatibility certification or a perceptual audio-sync measurement. MP4/H.264/AAC export, real phone variable-frame-rate video, Safari/Firefox, long media, hardware performance, and Windows/Electron have not been verified here. Runtime capability checks apply. Real user footage remains an important next test.

Export currently uses in-memory encoded output and a continuous offline stereo mix with windowed source decoding; a 2-minute cap bounds the initial workload. Clip boundaries use integer frames at a fixed 30 fps. Preview uses browser media playback; export uses decoded frames and offline audio, so exact colour and seeking consistency need further real-media tests.

GitHub Actions results are separate from local checks. Consult the Actions tab for current runs.

## v0.2.0: Android foundation, 23 October 2026

Passed locally: TypeScript/build, the core model/media tests, and the prior browser editing/export workflow after integration of the native save adapter.

New touch checks in Chromium's mobile/touch mode: import through the media sheet, add a clip, drag a trim handle and verify its new frame duration, duplicate, pinch the timeline to zoom, open/close clip and project sheets, save a project, and confirm dock visibility/no horizontal overflow in portrait and landscape. The portrait layout was visually inspected. The reproducible test is scripts/mobile-smoke.mjs.

Android compilation/lint are performed in .github/workflows/android.yml; consult the matching GitHub run for their result. Native file-provider dialogs, system bars on different Android versions, hardware codecs, real device playback/export and upgrade installation cannot be established by desktop touch emulation. These require the device checklist in ANDROID.md. No actual-device pass is claimed.

The Capacitor CLI's development-only xcode dependency currently reports moderate uuid advisories in npm audit. It is not bundled in the Android runtime; no forced dependency downgrade or unverified major override was applied.


## v0.2.1: import feedback and save bridge

Local core/build and touch checks cover the empty-panel import action, automatic media-sheet opening, filename/result feedback, the persistent media-ready prompt, Choose clips reopening the library, duplicate selection and failed import feedback without losing existing media. Existing touch editing and desktop export checks remain in use.

Android SaveByteCountTest verifies Integer/Long/Double input sizes, zero and subsequent chunk offsets, the 256 MB boundary and rejection of malformed sizes. The APK workflow runs these unit tests before assembly/lint. Full document-provider saving on a phone remains a device check; a unit pass does not establish it.


## v0.3.0: media cards, four tracks and cross-dissolves

Model checks cover overlapping main-track transitions/weights/duration, independent overlay and audio placement, split continuity, same-track collision rejection, transform validation, legacy project migration and new-setting round trips.

The composition browser test imports red/blue video with 440/880 Hz sound. It verifies thumbnails and duration labels, creates V1/V2/A1/A2 clips, checks picture-in-picture and blended preview pixels, plays across a dissolve, saves format-v2 settings and exports 150 frames. FFmpeg verifies the blended output pixels, complete decode and both soundtrack frequencies with main-track audio muted. Existing browser export/relink/cancel checks remain, alongside touch checks for destination/placement controls and vertical track panning.

These synthetic checks do not certify smooth playback, exact audio sync or export performance on an Android phone. MP4 hardware codecs, long edits and real variable-frame-rate footage remain device validation requirements.


## v0.4.0: creative, crop and export choices

Core tests validate new project fields and font/style bounds, caption timing/SRT round trips, crop ratios/bounds, output size/orientation/FPS choices and each adjustment's effect on pixels. The creative browser test checks all 13 transition previews; GPU grading; a bold/italic/underlined/struck/rotated coloured title; offline bundled-font loading; manual captions with SRT/VTT; ratio and free corner cropping; project persistence; mobile tool visibility; blank-project title draft preview/cancellation; and fully decoded portrait 480p outputs at 60 and 24 FPS. Decoded frames are checked for baked text and grading. Existing desktop/touch/multitrack regressions remain in the workflow.

This does not certify 4K export or performance on an Android phone. Tests use synthetic VP8/Opus video in Chromium. Actual MP4 codecs, real phone footage, OS keyboard/file-provider interactions and sustained device performance remain device checks. Fonts cover bundled Latin subsets, with system fallback for other scripts.

## v0.4.1 bulk editing and comparison

`npm test` includes bulk media ordering and track collision checks, short-transition clamping, grade scope and one-step history restoration. `npm run test:bulk` checks actual mobile controls, original/adjusted canvas pixels, slider updates without pausing playback, bulk persistence and undo, Cancel restoration and preview separation in portrait, landscape and desktop. The creative suite also renders adjusted output while Original comparison is enabled, verifying that preview comparison does not bypass export grading. Android hardware playback and touch feel still need real-device checks.

## v0.4.2 touch and fullscreen checks

`npm run test:touch-preview` uses Chromium touch input to verify that tapping a slider does not jump its value, vertical swipes actually scroll without changing any grade, horizontal dragging adjusts relatively and keyboard arrows still work. It checks the six 52 px lanes, 44 px clip targets, bottom-right fullscreen control, playback, orientation layout, Back/Escape exit and Fullscreen API fallback. MP4 HEVC selection probes the actual device: supported hosts encode and decode a real HEVC/AAC .mp4; unsupported hosts must block export with an explanation. Software-only test hosts do not establish phone HEVC support. Native rotation and immersive bars are compiled/linted in the APK workflow and still require device checks.

## v0.5.0 audio and relinking

Unit checks cover equal-power crossfade envelopes, independent track timing, short-clip clamps, intentional gaps, overlap rejection, edge fades, editing around joins, undo, v4 migration, settings/fingerprint persistence, renamed matching and same-name/same-size impostors. `npm run test:audio` imports real MP3s, measures shared Web Audio gain/EQ/pan/compression/limiting/bypass, taps live preview channels, exports and decodes a crossfade with edge fades, checks audio across processing-window boundaries, reopens after a full page reload, clears remembered media and batch-relinks renamed assets without changing edits. Android's provider-specific grants and restart behavior require device verification beyond native build/lint checks.

A simulated Capacitor bridge also verifies native picker options, URI-reference storage without copying, reopening through the content-URI route, Android-save bridge serialization and the Forget permission-release call. A fast touch sequence checks that opening Project cannot click through into another native import. This does not substitute for Android OS/provider grant validation on a physical phone.
