# Ordo changelog

## 24 October 2026: Android guide refreshed for v0.6.0

- Replaced the mixed historical Android notes with a current-release guide, organised into tables and task-based steps.
- Documented six-second image clips, Start/End/Between transitions, audio fades/crossfades, 66 fonts, current export settings and project format v5.
- Removed the obsolete 720p-only limit and v4 project-format statements; clarified APK updates, device checks and the Android-only distribution model.

## 24 October 2026: light-wave hero polish

- Added soft mint/cyan light waves, glow and small light accents around the real Android phone preview.
- Tightened hero spacing and adjusted the decorative composition for phone, tablet and desktop widths. Decorative layers do not block links or overlap the screenshot.
- Ambient glow respects reduced-motion preferences.

## 24 October 2026: real Android hero preview

- Replaced the illustrative desktop editor in the website hero with a screenshot supplied from an actual Android phone.
- Added a responsive mobile frame, a clean crop excluding OS bars and subtle presentation polish. The underlying screenshot is retained unchanged; no footage or controls are fabricated.

## 24 October 2026: Android website and documentation

- GitHub Pages now hosts the Android landing page and APK download links.
- The browser editor is no longer publicly deployed. Its web technology remains the internal Android application engine and development test harness.
- README reorganised into feature tables, installation steps, current limits and developer commands.

## v0.6.0: still images, clip-edge transitions and 66 fonts

- Import JPEG, PNG, WebP, AVIF, BMP and GIF images supported by the device. Animated formats are imported as a single still frame. Each image starts at 6 seconds, with a thumbnail and filename in Project media. Add all media includes images on the chosen picture track.
- Extend or shorten images with the same trim handles and In/Out controls as video. Split, duplicate, placement, V1/V2 layering, crop, picture adjustments and exports support image clips. The 24-hour timeline guard and initial 2-minute export limit remain.
- Transitions have Start, End and Between categories with 13 effects plus None. Start/End animate the picture on V1 or V2 without changing timing or sound; duration is 0.1–10 seconds, clamped to the clip length. Between overlaps adjacent V1 clips for 0.1–2 seconds. Apply to all works in each category.
- Audio transitions offer Fade in, Fade out and Crossfade with durations in seconds. Fade in/out can target any selected audio clip or all audio clips. First/last fades and applying crossfades to all adjacent joins remain available. Zero removes a fade.
- Titles and captions share 66 locally bundled Google Fonts. All work offline, including export. Where a family has no native bold or italic face, that style is synthesised. See [font catalogue](docs/FONTS.md) and bundled font licences.
- Project format v5 saves images and edge transitions, and opens v1–v4 projects. Save with the new version after opening an older project; older Ordo versions cannot open v5 saves.

## v0.5.0: remembered media and audio editing

- Remember media on this device reconnects assets when opening a project or restoring recovery. Android uses persistent read access granted through the system document picker; web imports and providers without persistent grants use local IndexedDB copies when storage permits. Forget remembered media clears those records/copies and Android read grants while leaving the current edit open.
- Locate missing media accepts multiple files together. Full streaming SHA-256 fingerprints recognise renamed sources and reject different content with the same name and size. Re-importing missing assets also relinks them. Older projects need an initial relink/import before their media can be remembered; ambiguous legacy matches require the individual Relink button. Moved/deleted files, revoked permissions, cleared app/browser data or storage limits can require locating files again.
- Selecting an MP3/audio clip or a clip on A1/A2 switches Adjust to audio controls: volume, gain, pan, three-band EQ, compressor, compressor-based limiter and per-clip fade in/out. Touch sliders keep their scroll protection. Reset, Apply to all audio clips, Cancel and one-step Undo remain available.
- The Adjusted checkbox bypasses picture grading and audio processing during playback. Clip volume, audio fades, crossfades and timeline timing stay active. Preview and export use the same Web Audio processing chain; export preserves continuous filter and compressor state across decoding windows.
- With an audio clip selected, Transitions opens audio crossfades on A1/A2, plus Fade in first audio clip and Fade out last audio clip. Crossfades use equal-power blending, clamp to half of either clip, overlap touching audio clips and shorten that track's assembly. Gaps and video timing remain intact. First/last fades also work on gapped tracks with crossfade switched off. Apply to all adjacent joins and Undo are supported. Timeline markers expose joins and clip fade durations.
- Touch menu openings no longer trigger an unintended control beneath the same tap.
- Project format v4 stores audio settings, crossfades and source fingerprints and reads v1/v2/v3 projects. Older Ordo versions cannot open v4 saves. Projects contain neither media bytes nor Android content URIs.

## v0.4.2: touch precision, compact tracks and fullscreen preview

- Touch adjustment sliders no longer jump on a tap. Vertical swipes scroll the panel without changing grades; deliberate horizontal drags adjust relative to the starting value at finer sensitivity. Mouse and keyboard controls remain available.
- All six timeline lanes (V1, V2, A1, A2, T and C) use 52 px rows instead of 88 px. Clips keep 44 px touch targets and visible trim handles.
- A fullscreen icon sits at the bottom right of the preview picture. Fullscreen keeps playback, scrubbing and the Adjusted checkbox available. Exit with the icon, Escape or Android Back without losing your edit.
- Android fullscreen hides system bars and enables full sensor rotation, then restores the previous orientation and system-bar settings on exit. Web fullscreen follows browser/device rotation support and falls back to a window-filling preview when the Fullscreen API is unavailable.
- Preview comparison is simply an Adjusted checkbox: checked shows grading, unchecked bypasses it. This affects preview only; exports retain adjustments.
- MP4 export now offers H.265 (HEVC) / AAC alongside H.264 / AAC and WebM VP8 / Opus. Encoder checks use the chosen resolution, FPS and bitrate; unsupported combinations are blocked with an explanation. H.265 remains device-dependent, and files retain the standard .mp4 extension. There is no silent codec substitution.

## v0.4.1: bulk editing and preview comparison

- Project media has Add all media, with separate video (V1/V2) and audio (A1/A2) destinations. Available files append in bin order; missing files are skipped with feedback. One Undo removes the whole insertion.
- Transitions has Apply to all joins for adjacent V1 clips. It replaces the join settings and clamps overlaps for short clips. Cut removes transitions at all joins.
- Adjust has Apply to all video clips. It replaces grades on V1/V2, preserving crop, placement, audio, text and transitions. Each bulk action is one undoable edit.
- Adjust is a compact scrolling panel below the preview in portrait and beside it in landscape/desktop. Playback and sliders remain available together. Apply commits the draft; Cancel restores the saved grade.
- The preview's Adjusted checkbox toggles between adjusted and original picture during playback or while paused. This bypasses picture adjustments only; crop, placement, text and transitions remain visible. It never changes saved projects or exported grades.
- Edit now uses an information icon, distinct from Adjust's sliders. Branding and Android application identity are unchanged.

## v0.4.0: creative tools, crop and export settings

- Dedicated Transitions, Title, Captions, Adjust and Crop buttons on desktop and in the Android dock.
- 13 transitions between adjacent V1 clips: dissolve, black/white fades, four wipes, left/right slides, left/right pushes and zoom in/out. Duration controls and sound crossfades are included; zoom out shrinks the outgoing picture.
- Timed titles and manual captions with 10 bundled Google Fonts, size, colour, rotation, bold, italic, underline, strikethrough, alignment, position, outline and background. Captions import SRT/VTT and export SRT.
- 11 picture controls: brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette and fade. Drafts preview live, including titles on a blank project; Apply makes one undoable edit and Cancel restores the original.
- Crop presets for original, 16:9, 9:16, 1:1, 4:3, 3:4, 4:5 and 21:9; Free size supports corner resizing, moving and numeric coordinates. Optionally match the project canvas to the crop.
- Export at 480p, 720p, 1080p or 2160p, with 24/25/30/50/60 FPS and compact/standard/high quality, when supported by the device's encoder. The output preserves the canvas orientation.
- V1/V2 video, A1/A2 sound and T/C title/caption lanes; thumbnails, touch trimming/zoom/panning, project saving/relinking and recovery remain available.

