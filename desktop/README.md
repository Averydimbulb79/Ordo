# Ordo for Windows

The Windows build uses Electron to run the existing TypeScript editor, retaining its project model, preview, timeline, effects, audio processing and browser-based export paths. Android-specific Capacitor native export, background Android service and Android file pickers are not portable to Windows; they require separate Windows-native replacements.

Run `npm ci`, `npm run build`, then `npx electron .` after installing Electron as a development dependency.

GitHub Actions workflow `Windows desktop` produces an unsigned Windows NSIS installer as a workflow artifact. Successful main-branch builds publish [Ordo-Windows-Setup.exe](https://github.com/Averydimbulb79/Ordo/releases/download/windows-latest/Ordo-Windows-Setup.exe) to the Windows preview release.

Desktop layout: media library left, program monitor centre, properties right, a single-row editing toolbar above the full-width timeline. Existing actions remain wired to their original handlers.

Known limitations: desktop hardware encoding, OS background export, update installation and full native feature parity remain to be implemented and validated on Windows.
