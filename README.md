## Ordo

A local video editor for the web. The same application will later be packaged with Electron for Windows. No AI, account or media upload required.

[Open Ordo](https://averydimbulb79.github.io/Ordo/) · [Roadmap](docs/ROADMAP.md) · [Components](docs/COMPONENTS.md) · [Validation](docs/VALIDATION.md)

### v0.1.0: first assembly editor

- Import supported video/audio files into the media bin and add them to a single sequential timeline.
- Preview, seek and step through the sequence, with source audio.
- Split at the playhead, trim source ranges, reorder clips, delete and undo/redo.
- Adjust clip volume, zoom the timeline and use full screen.
- Save a versioned .ordo project, reopen it and relink original media.
- Local recovery snapshots; portable project downloads remain the recommended backup.
- Export up to 2 minutes at 1280 × 720 / 30 fps as MP4 (H.264/AAC) or WebM (VP8/Opus), subject to browser codec support. Progress and cancellation included.

Start with Chrome or Edge on desktop. The compact layout supports basic use on smaller screens; mobile media support varies. Original files remain unchanged and are not embedded in .ordo projects. Keep those files for relinking.

### Quick start

1. Import media, then choose Add to sequence.
2. Select a clip. Click the ruler to move the playhead; Space plays or pauses.
3. Press S to split, or set source In/Out frames in Clip properties and Apply trim.
4. Save the project, then Export. Try WebM if MP4 encoding is unavailable.

Shortcuts: Space play/pause; arrows step; S split; Delete remove; Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z redo; Ctrl/Cmd+S save.

### Development

Node.js 22.12 or newer:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Browser workflow checks require ffmpeg and a Playwright Chromium installation:

```sh
npx playwright install chromium
npm run test:browser
```

GitHub Actions builds, tests and deploys main. Pages must use GitHub Actions as its publishing source. Windows packaging is deferred until the web editing workflow is proven; there is no EXE yet.

### Current scope

This is an early assembly editor, not FilmCraft feature parity. Multiple overlapping tracks, transitions, titles, effects, advanced colour, large-project optimisation and longer exports are future work. PixiJS remains an evaluated candidate; this release uses a shared Canvas 2D letterbox renderer for preview/export.

The 0.0.1 diagnostic source is archived in legacy/v0.0.1; its complete runnable state is preserved on backup/v0.0.1-before-editor. The original MIT licence remains unchanged. Dependency licences also apply.
