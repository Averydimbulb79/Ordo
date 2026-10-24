# Windows preview layout update

- Open maximized with the Windows taskbar visible; remove the Electron menu and separate title bar, with native caption controls integrated into the draggable app header.
- Keep the editing toolbar across all columns regardless of window height; restore controls when changing between desktop and mobile layouts.
- Fit the workspace within the viewport and keep timeline scrolling inside its panel.
- Fill the timeline panel width for short and empty sequences; retain horizontal scrolling for longer sequences and vertical scrolling for all six tracks.
- Enlarge the preview seek bar hit area without changing native keyboard controls or Android touch behavior.
- Scroll the full desktop media panel, including import feedback and storage controls, and reveal newly imported media.
- Repair the dependency lockfile for reproducible CI builds.

Import media, then choose Add to sequence or Add all media. The seek bar moves through the sequence, not unplaced media. Android native features and the shared editing model remain unchanged.

The installer is an unsigned Windows x64 preview. Physical laptop playback/export testing is still required.
