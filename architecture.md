# Architecture — Doki's Piano Chord Trainer

**Created:** 2026-11-03
**Derives from:** `SequenceMode.framework.md` and the `## Project Context` in
`CLAUDE.md`. No project-wide `framework.md` exists.
**Complexity target:** 2 (simple) (scope: project)

## Overview

The app is two practice modes, each its own page, sharing a small set of
services that know nothing about either mode: MIDI input, audio, storage and
the offline service worker. Everything is plain `<script>` tags with no build
step. Shared services announce or provide; modes listen or call. That one
direction is what lets a second mode arrive without disturbing the first.

## Guidelines

1. **Complexity ceiling is 2 (simple):** a few clear modules, plain data passed
   between them, no engines or general-purpose frameworks of our own. A design
   that needs more is raised with the user before it is built.
2. **One page per mode.** Each mode is its own HTML page, loads only the scripts
   it uses, and links to the other mode. A mode never reaches into another
   mode's code or state.
3. **Shared modules never reference a mode.** MIDI input, audio and storage
   expose what they do; modes register listeners or call them. Dependencies
   point from modes to shared modules, never back.
4. **New script files expose exactly one global name** — a namespace object —
   and keep everything else private inside the file. Existing chord-trainer
   files keep their globals until a change touches them for another reason;
   they are not converted for its own sake. A new file that only relocates
   existing chord-trainer code keeps that code's global names. Code guidelines
   give way where keeping the chord trainer working normally requires it.
5. **Load order on each page is: shared modules, then the mode's core, then the
   mode's shell.** A file uses only names from files loaded before it.
6. **All `localStorage` access goes through the shared storage helpers.** Each
   mode uses its own keys. Stored structures carry a version number. Renaming
   or reshaping a stored settings field bumps it and adds a converter, in its
   own commit. Stored work that is cheap to recreate — such as a generated
   passage — is discarded on a version mismatch instead of converted.
7. **Every file a page needs offline is in the service worker's asset list**,
   and the cache name is bumped in the same change that adds, removes or
   renames a served file.
8. **Third-party code is vendored as a plain script, used through one adapter
   file**, and must run with no build step and no network fetch at runtime —
   including fonts or other assets the library loads by itself. When the first
   such library lands, the `Rendering` and `Dependencies` lines of
   `CLAUDE.md`'s Project Context are updated in the same change.
9. **Refactors of shared code that a feature needs land first, as their own
   behaviour-neutral commits**, before the feature code that relies on them.
10. **`tests.html` is local only:** gitignored, linked from no page, absent from
    the service worker's asset list.

## Structure

**Shared** (page-independent, never reference a mode):

- **MIDI input** (`midi.js`) — device connection, held notes, sustain pedal,
  idle timeout, the Reset control and the raw message log. Tells registered
  listeners when a note is pressed, when the held set changes and when Reset
  is pressed.
- **Audio** (`audio.js`) — one tone, two capabilities: sounding a chord at once,
  and playing a timed list of notes.
- **Storage** — the guarded `localStorage` read and write helpers.
- **Offline shell** — `sw.js`, `manifest.json`.
- **Base styles** — `style.css`; a mode may add its own stylesheet.

**Chord trainer** — `index.html`, `music.js`, `rendering.js`, `settings.js`,
`practice.js`, `ui.js`. Registers its own MIDI listener for the live readout
and practice capture.

**Sequence Mode** — `sequence.html` and its own files. See
`SequenceMode.architecture.md`.

Dependency direction:

```
chord trainer ──┐                  ┌──▶ midi.js
                ├──▶ shared ───────┼──▶ audio.js
sequence mode ──┘                  └──▶ storage helpers
      (never the other way, never mode to mode)
```

## Decisions

### D1: Script organisation

- **Chosen:** classic `<script>` files; each new file exposes one namespace
  object and keeps the rest private.
- **Why:** no build step; the app still opens from `file://`, as the README
  promises; a vendored library's global fits in unchanged; the global surface
  shrinks to one name per file, which is what lets two modes coexist.
- **Drawbacks:** a convention, not enforced by the browser. Existing
  chord-trainer files stay global until touched, so the codebase holds two
  styles for a while.
- **Alternatives considered:** plain globals (no change, but two modes' names in
  one space and the coupling that already tied `midi.js` to `practice.js`);
  native ES modules (enforced privacy, but they do not load from `file://` and
  require converting the existing files).

### D2: Mode separation

- **Chosen:** a separate page per mode. `index.html` (chord trainer) and
  `sequence.html` (Sequence Mode) link to each other, so switching never means
  editing the URL.
- **Why:** the chord trainer is left undisturbed almost for free, as the
  framework requires ("Does not disturb the chord trainer"); each page loads
  only its own code.
- **Drawbacks:** switching reloads the page — instant offline, but an
  unfinished attempt resets, as the framework already accepts for a reload.
  Page chrome (header, MIDI panel markup) exists on both pages and can drift
  apart.
- **Alternatives considered:** one page with toggled panels (instant switching,
  but the chord trainer's resize and MIDI handlers would have to learn to stand
  down while hidden).

### D4: Tests

- **Chosen:** a local `tests.html` that runs checks on Sequence Mode's pure core
  in the browser, with no test framework. Gitignored and never uploaded.
- **Why:** catches generator rule breaks and comparison mistakes, and gives
  behaviour-neutral refactors and renames a baseline to compare against.
- **Drawbacks:** run by hand; exists only on the machine that wrote it, so it is
  not shared with anyone else working on the repository.
- **Alternatives considered:** no tests (checked by playing only).

### D5: MIDI layer decoupling

- **Chosen:** `midi.js` tells registered listeners when a note is pressed, when
  the held set changes (any note-on, note-off, pedal release or panic) and when
  the Reset button is pressed. Reset is its own announcement because only the
  button, not an idle-timeout panic, means "start over". The chord trainer's
  direct calls — the practice advance timer, the
  live chord check, the practice peak-held set cleared by Reset — move into the
  chord trainer's own listener.
- **Why:** required by D2 — on `sequence.html` the chord-trainer names
  `midi.js` currently calls do not exist. Dependencies then point one way, and
  Sequence Mode builds its list of played notes from the same announcements.
- **Drawbacks:** changes the chord trainer's wiring; it lands as its own
  behaviour-neutral commit before any Sequence Mode code (guideline 9).
- **Alternatives considered:** copying `midi.js` for the new page (trainer
  untouched, but two copies of the robustness fixes that would drift).

### D7: Playback

- **Chosen:** `audio.js` gains the ability to play a timed list of notes,
  reusing its existing tone. Chord playback is unchanged.
- **Why:** one module, one sound.
- **Drawbacks:** `audio.js` grows, though its job stays the same.
- **Alternatives considered:** a separate Sequence Mode player (two tone
  definitions that would drift).

### D13: Shared storage helpers

- **Chosen:** the guarded `readStored`/`writeStored` helpers move out of
  `settings.js` into a small shared file loaded by both pages.
- **Why:** `settings.js` also wires up the chord trainer's settings dialog when
  it loads, which would throw on `sequence.html` where that dialog does not
  exist.
- **Drawbacks:** one more file in the chord trainer's load order; lands as its
  own behaviour-neutral commit (guideline 9), separate from D5.
- **Alternatives considered:** duplicating the helpers in Sequence Mode (two
  copies of the storage guard).

## Infrastructure

- **Hosting:** static files only — GitHub Pages or any static server. No
  backend.
- **Persistence:** browser `localStorage` through the shared helpers (D13),
  per-mode keys, versioned (guideline 6). No database.
- **Offline:** the existing service worker — network-first for pages,
  stale-while-revalidate for other files. `sequence.html` and every Sequence
  Mode file, including the vendored notation library and any fonts it needs,
  join the asset list so the mode works offline before its first visit.
- **External fetches:** only the existing Google Fonts stylesheet, cached on
  first load. Nothing new may add one (guideline 8).

## Extensibility

The seams the two explored modes need, and no more:

- **MIDI announcements** — a mode registers a listener (D5).
- **Audio's two capabilities** — chord and timed list (D7).
- **Page per mode with cross-links** (D2).

## Open questions

1. **Shared page chrome.** The header and MIDI panel markup are repeated on both
   pages. *Default: accept the duplication at complexity 2; if the two copies
   start to drift, have the MIDI module build its own panel from one place.*
2. **Project-wide complexity target.** Set to 2 (simple), following the target
   chosen for Sequence Mode. *Default: keep it; revisit only if a future mode
   is explored that needs more.*
