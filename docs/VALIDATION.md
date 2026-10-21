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

Export currently uses in-memory output and per-clip offline audio rendering; a 2-minute cap bounds the initial workload. Clip boundaries use integer frames at a fixed 30 fps. Preview uses browser media playback; export uses decoded frames and offline audio, so exact colour and seeking consistency need further real-media tests.

GitHub Actions results are separate from local checks. Consult the Actions tab for current runs.
