# Doki's Piano Chord Trainer

## Project Context

- **Type:** App — a browser-based music practice tool, installable as a PWA.
- **Stack:** Vanilla JavaScript, HTML and CSS. No build step, no package
  manager, no framework. Scripts are plain `<script>` tags loaded in dependency
  order, so load order is part of the design.
- **Rendering:** Hand-rolled HTML canvas drawing for the chord trainer's staff
  and keyboard. Sequence Mode draws its notation as SVG with VexFlow, through
  `sequence/shell/notation.js` only.
- **Input:** Web MIDI for note input, Web Audio for playback.
- **Offline:** A service worker caches the whole app. Working offline is a
  requirement, not a nicety — the app is installed and used at the piano.
- **Dependencies:** VexFlow 4.2.5 (MIT), vendored in `vendor/vexflow/` as a
  plain script; its music font is built in, so it draws with no network
  request. Further third-party libraries are permitted where they clearly earn
  their place, but must be vendored into the repository and usable without a
  build step, so the offline PWA behaviour is preserved.

## Design frameworks

Feature design frameworks live beside this file as `<Feature>.framework.md`.
There is no project-wide `framework.md` yet; if one is added later, every
feature framework is subordinate to it.
