## Ordo

A video editor for the web, with a future Electron Windows edition. One shared application, local processing, no AI.

Version 0.0.1: component foundation. This is a diagnostic build, not an editor yet.

[Source](https://github.com/Averydimbulb79/Ordo) · [Roadmap](docs/ROADMAP.md) · [Components](docs/COMPONENTS.md)

### Try the foundation

Use Node.js 22.12 or newer:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The Component Lab checks graphics and local storage, reports browser API availability, and reads metadata from a local video or audio file. No media is uploaded. Editing, project saving and export are not implemented.

```sh
npm test
npm run build
npm run preview
```

### Web and Windows

Develop and validate the web workflow first, then wrap the same build in Electron. No separate desktop engine is selected. There is no Windows executable in this release.

GitHub Actions builds and tests each update to main and provides an `ordo-web` artifact. A manual Pages deployment workflow is included; enable GitHub Pages with GitHub Actions as its source before running it. No live deployment is claimed yet.

### Development

Dependencies are pinned in package.json and package-lock.json. Keep code modular, update this README with each release, and preserve a rollback checkpoint before substantial changes. The original repository is preserved on `backup/initial-foundation`.

FilmCraft is the feature benchmark, not an integrated dependency. Its suitability as a reusable engine remains unevaluated.

### Licence

Ordo retains its original MIT licence. Dependency licences and notices remain applicable; see [component notes](docs/COMPONENTS.md).
