## Ordo for Android

A free, open-source video editor for Android. Edit video, images and sound on your device, with no account or media upload required. No AI features.

[Download Android APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) · [Visit the website](https://averydimbulb79.github.io/Ordo/) · [Android guide](docs/ANDROID.md) · [Release history](docs/CHANGELOG.md)

| At a glance | Details |
| --- | --- |
| Current app | v0.6.0, development build |
| Platform | Android 7.0 or later; codec support varies by device |
| Website | Product information, real Android app preview and APK downloads |
| Privacy | Local editing and rendering; bundled offline fonts |
| Licence | MIT; dependency and font licences also apply |

### What you can do

| Tool | Available features |
| --- | --- |
| Media | Import video, audio and images; thumbnails, filenames and durations; Add all media |
| Timeline | V1/V2 picture tracks, A1/A2 audio tracks and T/C text lanes; trim, split, duplicate and reorder |
| Images | Six-second default; shorten or extend with normal trim controls; crop, grade, layer and export |
| Picture | Brightness, contrast, saturation, exposure, highlights, shadows, temperature, tint, sharpen, vignette and fade |
| Crop | Common aspect ratios, free sizing and an option to match the project canvas |
| Transitions | 13 effects plus None; Start/End clip animations and Between transitions on adjacent V1 clips; Apply to all |
| Titles and captions | 66 offline Google Fonts; size, colour, rotation, bold, italic, underline, strikethrough, positioning, outline and background |
| Subtitle files | Import SRT/VTT; export SRT |
| Audio | Volume, gain, pan, three-band EQ, compressor, limiter, fade in/out and A1/A2 crossfades; durations in seconds |
| Preview | Live adjustment panel, Adjusted comparison checkbox and fullscreen with sensor rotation on Android |
| Projects | Save .ordo files, Undo/Redo, recovery snapshots, remembered media and batch relinking |

### Install and start editing

1. Download the [latest APK](https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk) on your Android phone.
2. Open the downloaded file. If prompted, allow installation from the source you used to download it.
3. Import media, choose a destination track and tap Add to sequence, or use Add all media.
4. Select a clip to edit. Use the dedicated Transitions, Title, Captions, Adjust and Crop tools.
5. Save your .ordo project and retain the original media. Export when ready.

Updates use the same application ID and development signing certificate, with an increasing versionCode, so the APK can install over the existing app.

### Export options

| Setting | Choices |
| --- | --- |
| Format | MP4 H.264/AAC, MP4 H.265/AAC, WebM VP8/Opus |
| Resolution | 480p, 720p, 1080p, 2160p; preserves canvas orientation |
| Frame rate | 24, 25, 30, 50 or 60 FPS |
| Quality | Compact, Standard or High |

Available combinations depend on the device's encoders. The timeline runs at 30 FPS; higher export FPS does not create new motion in lower-frame-rate footage.

### Current limits

| Area | Current behaviour |
| --- | --- |
| Export duration | Up to 2 minutes |
| Android save size | Up to 256 MB; final encoded output is assembled in memory |
| Exporting | Keep the app in the foreground; large resolutions and frame rates need more memory |
| Transitions | Start/End leave timing unchanged; Between overlaps V1 clips and shortens the sequence |
| Independent tracks | V2/A1/A2 keep explicit timing and gaps; A1/A2 allow controlled crossfade overlaps |
| Image formats | JPEG, PNG, WebP, AVIF, BMP and GIF where supported; animated images import as one still frame |
| Fonts | 66 bundled Latin families; other scripts use device fallback; missing bold/italic faces use synthesised styles |
| Project compatibility | Saves v5; opens v1–v4; older Ordo versions cannot open v5 files |
| Media relinking | Project files do not embed media. Moved files, revoked access or cleared app storage may require relinking |

### Save and reopen projects

- Save .ordo files separately from the original media. Both are needed to keep an editable project.
- Remember media on this device retains permitted Android file access, or local copies when a provider cannot retain access and storage allows.
- Locate missing media reconnects multiple files. Content fingerprints recognise renamed files and reject different files with matching names and sizes.
- Older projects may need one initial relink and a new save before automatic reconnection works.
- Forget remembered media removes stored references/copies and permissions while leaving the current edit open.

### Development

The product is Android-only. The browser-based editing engine remains in the repository for the Capacitor APK and automated development checks. GitHub Pages publishes only the separate landing page.

| Requirement | Version |
| --- | --- |
| Node.js | 22.12 or later |
| Java | JDK 21 for Android builds |
| Android SDK | 36 |
| Browser checks | Playwright Chromium and FFmpeg |

| Command | Purpose |
| --- | --- |
| `npm ci` | Install pinned dependencies |
| `npm run dev` | Run the internal editor development harness |
| `npm test` | Run component checks |
| `npm run build` | Build the Android editor assets into dist |
| `npm run android:sync` | Build the editor and sync Capacitor's Android project |
| `npm run android:open` | Open the native project in Android Studio |
| `npm run build:landing` | Build the public Android website into landing-dist |
| `npm run dev:landing` | Preview the landing page locally |

Browser suites: `test:browser`, `test:mobile`, `test:composition`, `test:creative`, `test:bulk`, `test:touch-preview`, `test:audio` and `test:images`. Install Chromium with `npx playwright install chromium` before running them.

GitHub Actions builds the APK, checks the editor and deploys the landing page separately. [View build results](https://github.com/Averydimbulb79/Ordo/actions).

### Project links

| Reference | Contents |
| --- | --- |
| [Roadmap](docs/ROADMAP.md) | Planned features; development targets are not current capabilities |
| [Changelog](docs/CHANGELOG.md) | Release history |
| [Android guide](docs/ANDROID.md) | Native setup and phone checks |
| [Components](docs/COMPONENTS.md) | Editing engine and dependencies |
| [Validation](docs/VALIDATION.md) | Test coverage and limitations |
| [Fonts](docs/FONTS.md) | Font catalogue and style support |
| [Font licences](public/FONT-LICENSES.txt) | Bundled font terms |
| [Third-party licences](public/THIRD-PARTY-LICENSES.txt) | Additional dependency terms |

Keep rollback checkpoints before substantial changes and update this README with each release.
