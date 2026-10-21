# Ordo roadmap

## Agreed direction

One web editor developed on main, later packaged with Electron for Windows. Same interface, editing model, project format and processing implementation initially. No AI. FilmCraft is the capability benchmark; no performance parity is assumed.

## 0.0.1: component foundation

Pinned components, lockfile, modular source, diagnostic page, media tests and GitHub build workflow. Not an editing release. No legacy app exists to archive; the initial repository is kept on backup/initial-foundation.

## 0.1: smallest complete editing workflow

Import video/audio; frame-aware sequence model; preview and seeking; split and trim; undo/redo; downloadable versioned project file and media relinking; a working export with configuration checks and an explicit fallback where needed. Check audio sync and compare preview frames with export. No inert controls presented as finished features.

## 0.2: usable multitrack editor

Clip dragging, snapping, track controls, linked audio/video, waveform and thumbnail generation, keyboard controls, basic text and transforms. Autosave and recovery must accompany usable editing, rather than be postponed until finishing tools.

## 0.3: creative tools and performance

Transitions, opacity, keyframes, basic colour, bounded caches and background jobs. Reuse the compositor for export wherever possible. Measure representative phone footage and larger projects before adopting performance claims.

## 0.4: Electron packaging

Package the tested web build locally for Windows. Add GitHub Windows build workflow and downloadable executable, then verify the packaged app on Windows. No second editing engine. Code signing and automatic updates are separate distribution decisions.

## Later professional milestones

Advanced trim tools, nesting, adjustment layers, keyframe curves, masks, scopes, colour tools, audio mixer, manual captions, multicam and selected interchange formats. Compare actual workflows against FilmCraft; expand only after save/recovery/export remain dependable.

## Release discipline

- Work on main and preserve rollback checkpoints before substantial updates.
- Keep README short and accurate; put detailed planning here.
- Preserve prior working builds under legacy if an actual app is replaced later.
- Test media timing, project round trips, recovery and render consistency.
- Treat a successful build, passing automated checks and verified browser/Windows behaviour as separate results.
