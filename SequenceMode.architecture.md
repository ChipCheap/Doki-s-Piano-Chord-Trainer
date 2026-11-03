# Architecture — Sequence Mode

**Created:** 2026-11-03
**Derives from:** `SequenceMode.framework.md`; inherits `architecture.md`
**Complexity target:** 2 (simple) (scope: feature)

## Overview

A pure core turns settings into a passage and compares what was played with
it. A thin shell connects that core to the page, MIDI input, audio, storage and
the notation library. One plain-data passage is the single thing everything
reads, and every pitch in it is spelled — MIDI numbers are only ever derived
from a spelling, never the other way round.

## Guidelines

1. **The core is pure.** It takes plain data and returns plain data. It never
   touches the page, MIDI, audio, storage, timers or the notation library, and
   never reads the shell's state. Randomness is handed to it as an input rather
   than taken from the browser, so a test can fix it.
2. **Pitches are spelled throughout the core**: a letter, a numeric alteration
   and an octave. MIDI numbers are derived from the spelling only where the
   passage meets the keyboard — comparison against played input, playback, and
   excluding pitches bound to control keys. Nothing ever derives a spelling from
   a MIDI number.
3. **The passage is the single source of truth** (D9). Notation, playback,
   comparison and storage all read it; none keeps its own copy of the music.
4. **Each note's staff is for drawing only.** Comparison and feedback never read
   it, per the framework's Never #1: "Feedback never claims which hand made an
   error."
5. **Melody rules are applied while each note is chosen**, from the notes
   allowed at that point; the generator never produces material and discards
   it. A position with no allowed note takes the nearest chord tone. A range too
   small to generate in is returned as a reported failure, never as a degenerate
   passage.
6. **Difficulty is a plain set of tunable parameters** — weights and limits,
   such as how likely each interval or rhythm value is, which keys are allowed
   and each hand's range. Named presets fill them in as starting points. The
   generator reads parameters, never preset names. Weighted choices over data,
   not a rules engine — that is what keeps it at complexity 2.
7. **Only the notation adapter refers to the notation library.**
8. **Only the state owner changes the mode's state, and only along the
   framework's transitions.** Everything shown — including whether playback is
   offered — is derived from the current state.
9. **All input passes through the bindings layer first.** A bound key is a
   command and never becomes a played note. An unbound key becomes a played
   note only while a passage is shown or an attempt is running; the first one
   on a shown passage starts the attempt.
10. **Played notes carry their order only.** No timestamp is stored with them,
    and comparison never reads time — the framework's Never #2: "Timing is
    never evaluated. Neither tempo, duration nor lateness is judged."
11. **Meter knowledge lives in one place.** Which beats are strong, and how
    notes group into beats, is defined once for each time signature; the
    generator's rhythm and the notation adapter's beaming both read it.

## Structure

**Core (pure):**

- **Passage model** — the data shape: key, time signature, bars, and in each bar
  the groups of notes that start together, each note with its spelled pitch,
  duration and staff; rests included.
- **Theory** — keys, major and minor scales (harmonic for chords, melodic for
  stepwise right-hand lines), spelling within a key, meter (guideline 11), and
  the spelled-pitch-to-MIDI conversion.
- **Generator** — settings, difficulty parameters, excluded pitches and a random
  source in; a passage or a reported failure out. Holds the progression
  templates, left-hand patterns, rhythm choice and melody rules.
- **Comparison** — passage and played list in; a per-bar report out (missed,
  extra, out of order, not attempted), with octave displacement detected once
  for the whole passage. Also the simpler whole-passage check: which notes came
  up at all.

**Shell (`sequence.html` and its files):**

- **State owner** — the four framework states (no passage, passage shown,
  attempt, review) and their transitions.
- **Input and bindings** — listens to MIDI announcements and the computer
  keyboard; sends commands to the state owner and played notes to the attempt.
- **Notation adapter** — draws the passage with the notation library.
- **Review view** — shows the comparison report per bar, and the whole-passage
  check beside it.
- **Playback** — converts the passage to timed MIDI numbers and hands it to the
  shared audio module, only when the state allows.
- **Settings and storage** — difficulty, time signature, left-hand pattern and
  control bindings for both input methods; the current passage. All through the
  shared storage helpers, under Sequence Mode's own versioned keys.

Dependency direction:

```
shell ──▶ core            (core depends on nothing outside the core)
shell ──▶ shared          (midi.js, audio.js, storage helpers)
notation adapter ──▶ notation library   (the only file that does)
```

Data flow through one attempt:

```
MIDI / computer keys ─▶ bindings ─┬─ command ─▶ state owner
                                  └─ note ────▶ played list ─┐
generator ─▶ passage ─┬─▶ notation adapter                   │
                      ├─▶ storage                            ▼
                      ├─▶ playback (after the attempt)  comparison ─▶ review view
                      └──────────────────────────────────────▲
```

## Decisions

### D3: Layering

- **Chosen:** a pure core (theory, generator, comparison, passage model) and a
  thin shell for everything that touches the page, devices or libraries.
- **Why:** the generator and comparison are the rule-heavy parts; isolated, they
  can be tested in `tests.html` and the notation library can be swapped without
  touching them.
- **Drawbacks:** one boundary to keep, and some translation at the edge.
- **Alternatives considered:** files mixing logic and page code, as in the chord
  trainer (familiar, fewer files, but the coupling `midi.js` showed is that
  pattern's cost).

### D6: Control bindings

- **Chosen:** in Sequence Mode's shell, between the MIDI announcements and the
  core. Bound keys are consumed as commands; the bound pitches are passed to the
  generator as excluded, per the framework's Never #4: "The generator never
  produces a pitch bound to a control key."
- **Why:** exactly one place decides whether a key is a command or a note.
- **Drawbacks:** the chord trainer cannot use bindings without moving them —
  acceptable, since the framework scopes them to this mode.
- **Alternatives considered:** bindings in the shared MIDI layer (builds for a
  need nobody has explored).

### D8: Notation

- **Chosen:** VexFlow, vendored into the repository and used by exactly one
  notation adapter.
- **Why:** named in the framework, and it handles beams, flags, rests,
  duration-based spacing and key signatures — the drawing the framework chose a
  library to avoid hand-building.
- **Drawbacks:** a large file; Sequence Mode will not look like the chord
  trainer (accepted in the framework). Some builds may fetch music fonts from
  the network, which the framework's Never #6 forbids: "A dependency is never
  added that requires a build step or a network fetch at runtime." See Open
  question 1.
- **Alternatives considered:** abcjs (the generator would write music text; less
  layout control, and its audio needs downloaded sound files); hand-drawn
  canvas extending `rendering.js` (no dependency, but all the engraving
  hand-built).

### D9: Passage as the single source of truth

- **Chosen:** one plain-data passage, shaped as in Structure, read by notation,
  playback, comparison and storage.
- **Why:** follows from D3. The comparison already needs the passage as groups
  of notes that start together, and plain data can be stored as is.
- **Drawbacks:** the notation adapter has to translate it for the library.
- **Alternatives considered:** the generator building library objects directly
  (fewer layers, but the core would depend on the library and the result could
  not be stored).

### D10: Theory and pitch representation

- **Chosen:** key and scale theory lives in Sequence Mode's core, with its own
  spelled pitch (letter, numeric alteration, octave). `music.js` is not loaded
  on `sequence.html`. The user delegated this choice, with one standing
  principle, now guideline 2: spelling is the source of truth and MIDI numbers
  are only derived from it.
- **Why:** raising the 6th and 7th in minor keys, and spelling double sharps in
  keys such as G♯ minor, is arithmetic on alterations — clean with numbers,
  awkward with the symbol codes `music.js`'s `Note` uses (`'x'`, `'#'`, `'b'`,
  `'V'`). It also leaves the chord trainer's file untouched.
- **Drawbacks:** the app holds two pitch representations. If the chord trainer
  ever adopts keys (the ROADMAP's scale-aware accidentals), unifying them is a
  migration of its own.
- **Alternatives considered:** reusing `Note` (one pitch type, awkward
  arithmetic); a new shared theory file (builds for an unexplored ROADMAP
  item).

### D11: State ownership

- **Chosen:** one state owner in the shell with exactly the framework's states
  and transitions; the screen is derived from its state.
- **Why:** rules about what is allowed when cannot scatter. Playback before an
  attempt finishes is impossible because no state offers it — the framework's
  Never #5: "Playback is never available before an attempt has finished."
- **Drawbacks:** none worth naming at this size.
- **Alternatives considered:** flags spread across handlers, as with
  `practiceActive` in `practice.js`.

### D12: What is stored for a reload

- **Chosen:** the passage itself, plus the settings, under Sequence Mode's own
  versioned keys. On reload the passage is restored and the attempt starts over,
  as the framework decides. A passage saved under an older version is discarded
  and the mode opens empty (`architecture.md` guideline 6).
- **Why:** what comes back is exactly what was on screen, whatever has changed in
  the generator since.
- **Drawbacks:** a few kilobytes of `localStorage`.
- **Alternatives considered:** storing a random seed (tiny, but any change to the
  generator turns an old seed into a different passage).

## Extensibility

The seams the framework calls for, and no more:

- **Time signatures** — the ladder 4/4, 3/4, 6/8 (and 7/8 if it is ever
  justified). Adding one means defining its meter once (guideline 11) and the
  left-hand patterns that fit it. No general meter engine.
- **Left-hand patterns** — entries in a list, each declaring the time signatures
  it fits.
- **Progression templates** — entries in a list per major and minor.
- **Difficulty presets** — named sets of parameter values (guideline 6).

## Relation to project architecture

Inherits every guideline in `architecture.md`. Sequence Mode is a page of its
own (D2), uses the shared MIDI announcements (D5), audio's timed-list playback
(D7) and the shared storage helpers (D13), and puts its tests in the local
`tests.html` (D4). Its core and shell are its internal structure; neither is
visible to the chord trainer.

## Open questions

1. **VexFlow build and fonts.** Default: the implementer confirms that the
   chosen build draws with no network fetch. If it does fetch fonts, those fonts
   are vendored and cached too. If neither works, D8 is reopened.
2. **Meter for 6/8 and 7/8.** The framework's open question 2 reads: "Beaming
   and grouping conventions for compound and asymmetric meters … *Default:
   research before building beyond 3/4.*" Guideline 11 only fixes where that
   knowledge lives. Default: as the framework says.
