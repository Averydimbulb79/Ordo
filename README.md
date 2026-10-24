## Windows desktop preview

[Download the Windows x64 installer directly](https://github.com/Averydimbulb79/Ordo/releases/download/windows-latest/Ordo-Windows-Setup.exe). The unsigned preview installer is built and published by [GitHub Actions](https://github.com/Averydimbulb79/Ordo/actions/workflows/windows.yml).

Windows opens maximized within the work area, keeping the taskbar visible. The default Electron menu and separate title bar are removed; native minimize, restore and close buttons share the app header. Drag the header to move a restored window.

Windows layout update: the editing toolbar stays full width at shorter window heights, the timeline fills the panel, the preview seek bar has a larger drag target, and Project media scrolls through controls and imported files. Importing alone does not create a sequence: use **Add to sequence** or **Add all media** before seeking or playback. Physical Windows laptop playback and export testing remains required.

The desktop uses the same TypeScript editor core, with a widescreen media bin, preview, inspector, single-row editing toolbar and full-width timeline. Windows packaging uses Electron. See [desktop notes](desktop/README.md).

# Ordo for Android

A free, open-source video editor for Android. Edit video, images and sound locally, with no account or media upload required. No AI features.

[Download APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Website](https://averydimbulb79.github.io/Ordo/) · [Android guide](docs/ANDROID.md) · [Changelog](docs/CHANGELOG.md)

| Release | Requirements | Licence |
| --- | --- | --- |
| v0.10.0 · Development build | Android 7.0+; codec support varies by device | MIT, with bundled dependency licences |

### Features

| Area | Available tools |
| --- | --- |
| Timeline | V1/V2 picture tracks, A1/A2 audio tracks, titles and captions; trim, split, duplicate, reorder, Delete and Undo |
| Media | Video, audio and still images; thumbnails, durations, batch insertion and relinking |
| Clip speed | Video/audio presets and custom 0.25×–4× speed; pitch preservation, same-track ripple and scoped Apply to all |
| Images | Six-second default; drag edges to shorten or extend; crop, adjust, layer and add transitions |
| Titles and captions | 66 offline Google Fonts; drag to move, corner handles to resize, rotation, styling, opacity and Start/End transitions |
| Picture | Eleven adjustment controls, crop presets/free sizing, position, scale and opacity; bulk adjustments |
| Transitions | Thirteen picture effects; Start/End animations and Between joins; audio fades and crossfades |
| Sound | Original video and imported audio volume; separate bulk controls, gain, pan, EQ, compressor and limiter |
| Preview | Live adjustments, Adjusted comparison and fullscreen with Android sensor rotation |
| Projects | Editable .ordo files, Undo/Redo, recovery snapshots, remembered media and batch relinking |

### Get started

1. Download and install the APK. Allow installation from your browser or file manager if Android asks.
2. Import media, choose destination tracks and use Add to sequence or Add all media.
3. Select a clip and open Edit. Dedicated tools handle Transitions, Titles, Captions, Adjust and Crop.
4. Save your .ordo project and retain the original media files.
5. Export and choose a destination in Android's Save as dialog.

Install updates over the existing app. Ordo checks for newer builds at startup and offers Download update or Later; offline checks are silent. See the [Android guide](docs/ANDROID.md) for step-by-step editing instructions.

### Export

| Setting | Options |
| --- | --- |
| Format | MP4 H.264/AAC, MP4 H.265/AAC or WebM VP8/Opus |
| Resolution | 480p, 720p, 1080p or 2160p, preserving canvas orientation |
| Frame rate | 24, 25, 30, 50 or 60 FPS |
| Quality | Compact, Standard or High; estimated file size shown before export |

| Export path | What to expect |
| --- | --- |
| Native Android | Eligible MP4 timelines use Media3 for video decoding, effects and encoding, including clip speed, titles and captions. Encoded video saves directly from cache to the chosen document |
| Compatible | Preserves edits requiring the shared compositor, including picture transitions, grading, picture opacity, V2 overlays, gaps and unsupported native media. Also handles WebM and timelines extending beyond the picture |
| Background | Native rendering continues when switching apps or turning off the screen, with progress, Cancel and completion notifications. Keep Ordo open during preparation and compatible rendering; return to save |
| Recovery | Native codec failure can retry compatible export. Frame-decoder stalls can use preview or Android frame recovery while retaining effects and sound |

Device codec support determines available settings and acceleration. H.265 or higher FPS does not guarantee faster export. Slow motion repeats source frames; it does not interpolate new motion.

### Current limits

| Area | Limit or behaviour |
| --- | --- |
| Export duration | No fixed app duration cap; available memory, cache storage and Android background-service limits still apply |
| Save size | Compatible Android export: up to 256 MB, with conservative preflight checks. Native output streams to the selected document and does not use this compatible-path limit |
| Background jobs | Force-closing, removing the app's task, process termination or restarting the phone stops export; jobs do not resume automatically |
| Memory | Both export paths retain the stereo audio mix in memory; compatible export also assembles encoded output in memory |
| Timeline | Up to 24 hours; practical export capacity depends on the device and project |
| Project format | Opens v1–v6. New projects use v5; applying speed upgrades them to v6, which requires v0.10.0 or later |
| Media | Projects do not embed source files. Moved files, revoked access or cleared app storage may require relinking |
| Images and fonts | Animated images import as one still frame. Bundled fonts cover Latin text; other scripts use device fallback |

For export details, troubleshooting and media recovery, read the [Android guide](docs/ANDROID.md). Release-by-release changes belong in the [changelog](docs/CHANGELOG.md).

### Development

The product is Android-only. The browser editor is an internal development/test harness; GitHub Pages publishes the separate landing page.

| Requirement | Version |
| --- | --- |
| Node.js | 22.12+ |
| Android builds | JDK 21 and Android SDK 36 |
| Browser checks | Playwright Chromium and FFmpeg |

| Command | Purpose |
| --- | --- |
| `npm ci` | Install pinned dependencies |
| `npm run dev` | Run the editor development harness |
| `npm test` | Run component checks |
| `npm run build` | Build editor assets into dist |
| `npm run android:sync` | Build assets and sync the Capacitor project |
| `npm run android:open` | Open the Android project in Android Studio |
| `npm run build:landing` | Build the public website into landing-dist |
| `npm run dev:landing` | Preview the landing page |

See [build instructions](docs/ANDROID.md#build-locally), [validation](docs/VALIDATION.md) and [GitHub Actions](https://github.com/Averydimbulb79/Ordo/actions). Browser suites are listed in package.json; install Chromium with `npx playwright install chromium` before running them. App labels, Android versionName and landing-page release labels use the package.json version.

### Documentation and licences

| Reference | Contents |
| --- | --- |
| [Android guide](docs/ANDROID.md) | Installation, editing, export, troubleshooting and local builds |
| [Changelog](docs/CHANGELOG.md) | Release history |
| [Roadmap](docs/ROADMAP.md) | Planned work, not current capabilities |
| [Components](docs/COMPONENTS.md) | Engine and dependency information |
| [Validation](docs/VALIDATION.md) | Automated coverage and verification limits |
| [Fonts](docs/FONTS.md) | Font catalogue and style support |
| [Font licences](public/FONT-LICENSES.txt) | Bundled font terms |
| [Third-party licences](public/THIRD-PARTY-LICENSES.txt) | Additional dependency terms |
| [Media3 licence](public/MEDIA3-LICENSE.txt) | Native export engine terms |
| [Signalsmith licences](public/SIGNALSMITH-LICENSES.md) | Offline pitch-preserving audio terms |
