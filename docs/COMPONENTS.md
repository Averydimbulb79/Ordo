# Component evaluation

Status: 0.1.0, 22 October 2026. Downloaded components are candidates, not a complete editing engine. Version numbers are fixed for this reproducible baseline; they are not claims of being the newest releases.

| Component | Version | Role | Licence recorded in package |
| --- | --- | --- | --- |
| Mediabunny | 1.62.0 | Container reading/writing and WebCodecs integration | MPL-2.0 |
| PixiJS | 8.22.0 | Candidate visual compositor for frames, text and effects | MIT |
| idb | 8.0.4 | IndexedDB helper for local recovery data | ISC |
| Vite | 8.3.5 | Build and development server | MIT |
| TypeScript | 5.9.3 | Static checks | Apache-2.0 |

Sources: https://mediabunny.dev/guide/introduction ; https://pixijs.com/8.x/guides/getting-started/intro ; https://github.com/jakearchibald/idb ; https://vite.dev ; https://www.typescriptlang.org .

Browser-provided components: WebCodecs, Web Audio/AudioWorklet, file APIs and workers. These are APIs, not npm downloads. Codec support must be checked at runtime for each configuration; finding VideoEncoder in a browser does not guarantee MP4/H.264/AAC export.

## Gathered and verified

- Exact direct dependency versions and transitive dependency integrity are recorded in package-lock.json. Use npm ci; do not commit node_modules or package tarballs.
- Media tests exercise a generated PCM WAV's duration, channel count and sample rate, and invalid-input handling.
- The archived Component Lab imports all three runtime dependencies. It performs a WebGL draw and an IndexedDB write/read/delete check in the actual browser, and allows local metadata inspection.
- File names and errors are rendered as text, never as HTML.

## Current integration

Mediabunny now powers import metadata and frame/audio export. The editor uses a shared Canvas 2D letterbox draw function for preview and export, HTML media playback for preview sound, OfflineAudioContext for exported audio, and idb for recovery snapshots. PixiJS is retained as a compositor candidate but is not imported into the editor bundle. Playwright 1.62.1 (Apache-2.0) is a development-only browser-test dependency.

## Still to prove

- Synchronised multitrack preview, precise seeks, cuts and frame scheduling.
- Shared frame composition for preview and export, including colour behaviour and text.
- Audio mixing and identical offline export results.
- Codec availability, large-file memory use, cancellation and format fallbacks.
- Windows/Electron compatibility, offline packaging and real device performance.

PixiJS draws graphics; it does not provide a video timeline or media export. Mediabunny handles media operations; it does not provide the editor UI, undo, project recovery or a multitrack editing model. We must implement those connections.

## Deferred

- Electron: add after the basic web workflow passes; use the same built application and processing implementation initially.
- ffmpeg.wasm: possible optional fallback only after a specific unsupported-format need is established. Its core download, memory use, hosting requirements and licence configuration require evaluation.
- Native MLT/FFmpeg: not part of the currently agreed web-first scope.
- FilmCraft: benchmark only. Before reusing code, build and test its browser target, inspect integration cost and notices, then make an explicit foundation decision. Do not combine two overlapping engines without evidence of benefit.

## Notices

Keep dependency licence texts with distributed code and generate a complete distribution notice inventory before public release. The Ordo MIT licence does not replace dependencies' licences. Modifying MPL-covered source files requires review of those files' source-distribution obligations. Codec availability and patent considerations are distinct from a library's source licence.

## Android addition: 0.2.0

Capacitor core/android/cli 8.5.3 (MIT) wrap the shared build. A small repository-owned Java plugin uses Android's Storage Access Framework for explicit Save as destinations, with chunked writes and completion checks. Capacitor's built-in SystemBars integration handles insets with viewport-fit=contain. Android's Back action is bridged to the editor so panels can close before exiting.

Primary references: https://capacitorjs.com/docs/android ; https://capacitorjs.com/docs/plugins/android ; https://capacitorjs.com/docs/android/configuration .

## Shared composition: 0.3.0

Repository-owned model.ts computes four-track placements and transition weights; composition.ts paints the same layers/transforms for preview and export. Preview uses browser media elements for the active layers. Mediabunny CanvasSink supplies export frames and cached media-card thumbnails; AudioBufferSink plus Web Audio mix independent audio in one-second blocks. This is a first multitrack implementation, with real-device sync/performance still to validate. No keyframe automation engine or additional transition catalogue is integrated yet.


## Creative pipeline: 0.4.0

creative-model.ts validates text/transition/grading data; creative.ts supplies dedicated panels; transitions.ts, text-renderer.ts and adjustments.ts provide shared rendering; crop.ts supplies normalized source cropping; export-settings.ts resolves output dimensions/bitrate. All operate locally. WebGL grading is conventional image processing with a CPU fallback. Ten pinned @fontsource packages provide Google Fonts and their real regular/bold/italic Latin styles. Their licences are retained in public/FONT-LICENSES.txt and copied into web/APK assets by Vite.

Official font references: https://developers.google.com/fonts/docs/css2 ; https://github.com/google/fonts .
