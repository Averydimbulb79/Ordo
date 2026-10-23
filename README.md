## Ordo

An Android-first video editor, with a shared web build. Local editing, no account or media upload required, and no AI features.

[Open web editor](https://averydimbulb79.github.io/Ordo/) · [Android APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Roadmap](docs/ROADMAP.md) · [Android guide](docs/ANDROID.md)

### v0.4.0: creative tools, crop and export settings

- Dedicated Transitions, Title, Captions, Adjust and Crop buttons on desktop and in the Android dock.
- 13 transitions between adjacent V1 clips: dissolve, black/white fades, four wipes, left/right slides, left/right pushes and zoom in/out. Duration controls and sound crossfades are included; zoom out shrinks the outgoing picture.
- Timed titles and manual captions with 10 bundled Google Fonts, size, colour, rotation, bold, italic, underline, strikethrough, alignment, position, outline and background. Captions import SRT/VTT and export SRT.
- 11 picture controls: brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette and fade. Drafts preview live, including titles on a blank project; Apply makes one undoable edit and Cancel restores the original.
- Crop presets for original, 16:9, 9:16, 1:1, 4:3, 3:4, 4:5 and 21:9; Free size supports corner resizing, moving and numeric coordinates. Optionally match the project canvas to the crop.
- Export at 480p, 720p, 1080p or 2160p, with 24/25/30/50/60 FPS and compact/standard/high quality, when supported by the device's encoder. The output preserves the canvas orientation.
- V1/V2 video, A1/A2 sound and T/C title/caption lanes; thumbnails, touch trimming/zoom/panning, project saving/relinking and recovery remain available.

### Use on your phone

1. Import footage, choose V1/V2/A1/A2 on its media card and Add to sequence.
2. Select a video clip, then use Adjust or Crop. Use Transitions to pick a join between two V1 clips.
3. Title and Captions create timed text. Tap an existing T/C timeline item to edit it. Swipe vertically in the timeline to reach lower lanes.
4. Apply commits panel changes; Cancel discards the draft. Save your .ordo project through Project and keep the original footage for relinking.
5. Export, choose format/resolution/FPS/quality, then save the finished video. Compatibility is checked for the selected settings.

Transitions overlap V1 clips and shorten the sequence accordingly; very short clips use a shorter overlap. V2/A1/A2 have independent timing and allow gaps; clips on the same independent track cannot overlap. New clips append to that track's end or the playhead, whichever is later.

The timeline still edits at 30 FPS; output sampling uses the chosen FPS. A higher output FPS does not invent additional motion in a lower-frame-rate source. Two-minute export and 256 MB Android saving limits remain while final encoded output is held in memory. Higher resolution/FPS costs more memory and processing. Keep the app in the foreground during export and test the result on your phone.

Project format v3 stores text, transitions, grading, crop and canvas size, and reads older v1/v2 projects. Older Ordo versions cannot open v3 files. Media and thumbnail images are not embedded. The APK uses the same application ID/development signing certificate and an increasing versionCode for install-over updates.

### Fonts and next features

Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Merriweather, Playfair Display, Source Sans 3 and Roboto Mono are bundled with regular/bold/italic variants for offline use. These are a curated Google Fonts selection, not the complete online catalogue. The bundled files cover Latin text; other scripts use device fallback fonts. Font licences ship in FONT-LICENSES.txt.

Keyframes, retiming, additional tracks, masks, chroma key and advanced audio tools remain roadmap targets. Windows work is deferred. No AI functions are included.

### Development

Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:mobile
npm run test:composition
npm run test:creative
```

Browser tests require ffmpeg. Android builds require JDK 21 and Android SDK 36. GitHub Actions tests main, publishes the web build and builds an installable APK. Consult [Actions](https://github.com/Averydimbulb79/Ordo/actions) for current results.

Preserve rollback checkpoints before substantial changes and update this README each release. Ordo retains its MIT licence; dependency licences also apply. [Components](docs/COMPONENTS.md) · [Validation](docs/VALIDATION.md)
