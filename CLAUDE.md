# Doki's Piano Chord Trainer

## Project Context

- **Type:** App — a browser-based music practice tool, installable as a PWA.
- **Stack:** Vanilla JavaScript, HTML and CSS. No build step, no package
  manager, no framework. Scripts are plain `<script>` tags loaded in dependency
  order, so load order is part of the design.
- **Rendering:** Hand-rolled HTML canvas drawing for the staff and the keyboard.
- **Input:** Web MIDI for note input, Web Audio for playback.
- **Offline:** A service worker caches the whole app. Working offline is a
  requirement, not a nicety — the app is installed and used at the piano.
- **Dependencies:** None at present. Third-party libraries are permitted where
  they clearly earn their place, but must be vendored into the repository and
  usable without a build step, so the offline PWA behaviour is preserved.

## Design frameworks

Feature design frameworks live beside this file as `<Feature>.framework.md`.
There is no project-wide `framework.md` yet; if one is added later, every
feature framework is subordinate to it.
