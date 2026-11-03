# Plan: Sequence Mode

**Outer iteration:** 1
**Realizes framework:** SequenceMode.framework.md
**Within architecture:** SequenceMode.architecture.md (+ project architecture.md), complexity target 2 (simple)
**Previous version:** none — first iteration

## Priority

Generation and notation come first and must be solid. The framework says the
per-bar review is a bonus: "if alignment does not give satisfying results in
practice, the whole-passage check is the review, and an attempt ends with
done." So milestone D (S23–S25) is best effort. If the alignment doesn't feel
right when played, stop after S22 plus S26 (playback) and report back rather
than tuning it endlessly.

## Framework open questions settled here

- **1, 7/8:** out of this plan, as the framework's default ("treat as a stretch
  goal").
- **2, compound meter:** this plan builds 4/4 and 3/4 only. 6/8 gets its own
  follow-up plan.
- **3, first left-hand patterns:** all five ship. Waltz bass only in 3/4.
- **4, difficulty:** not fixed levels. Every generation choice is a tunable
  weight or limit, like the chord trainer's randomiser. Four named presets fill
  them in as starting points (S8).
- **5, chord trainer migration:** out of scope.
- **6, too little range:** each hand needs at least one octave of consecutive
  keys not bound to a control; otherwise the player is told which bindings
  collide (S13). This replaces the "three octaves" default, because one free
  octave per hand is exactly what guarantees generation succeeds.

## Framework coverage map

| Framework goal | Plan steps |
|---|---|
| G1: Separate mode page, linked both ways | S16 |
| G2: Random major or minor key first, progression from that mode's templates | S9, S13 |
| G3: Key signature; accidentals only for departures | S5, S15 |
| G4: Minor — raised 7th in V and vii° only; melodic minor in stepwise lines, matching the chord's 7th | S5, S12 |
| G5: One left-hand pattern per passage, five figures | S11 |
| G6: Right-hand line under the melody rules, chosen constructively | S10, S12 |
| G7: Rhythm — half, quarter, eighth, dotted, rests; no sixteenths or ties across barlines | S6, S10 |
| G8: 4/4 and 3/4 | S6, S10, S11 |
| G9: Full rhythmic notation | S15 |
| G10: Per-bar review by alignment — missed, extra, out of order (bonus) | S23, S25 |
| G11: Whole-passage check, built first, kept as a second view | S14, S21 |
| G12: Octave displacement reported once (bonus) | S24, S25 |
| G13: The framework's transition table | S18 |
| G14: Playback only after an attempt (Never #5) | S3, S18, S26 |
| G15: Settings — tunable difficulty, time signature, left-hand pattern, bindings for both input methods side by side | S8, S19, S20 |
| G16: Empty state before the first passage | S16, S18 |
| G17: Whole passage visible from the start, never advancing or scrolling (Always #1) | S15, S16 |
| G18: Attempt ends at the end of the alignment or manually; manual end always exists (Always #3) | S18, S25 |
| G19: Missed repeat of a pitch → one missing instance in that bar (bonus) | S23 |
| G20: Gave up partway → remaining bars not attempted (bonus) | S23, S25 |
| G21: Dropped or corrupted input absorbed (bonus) | S23 |
| G22: Far-away extra notes reported in the bar where they occurred (bonus) | S23 |
| G23: Notes of one group match in any order (bonus) | S23 |
| G24: Keys never released has no effect | S14, S19, S23 |
| G25: No allowed note → nearest chord tone, no stall or retry | S12 |
| G26: Reload restores the passage and resets the attempt; outdated passage dropped | S17, S18 |
| G27: Bound pitches never generated; too little range is reported (Never #4) | S11, S12, S13, S19 |
| G28: Each hand stays in its staff (Always #4, Never #3) | S8, S11, S12 |
| G29: Pitches within MIDI 21–108 (Always #5) | S8, S13 |
| G30: Settings persist (Always #6) | S17, S20 |
| G31: Offline and installable, no runtime fetch or build (Always #7, Never #6) | S15, S22 |
| G32: No hand attribution (Never #1) | S14, S23, S25 |
| G33: Timing never evaluated; no timestamps (Never #2) | S19, S23 |
| G34: Reuses MIDI layer (Reset, raw log) and audio; chord trainer undisturbed | S1, S2, S3, S16 |

## Plan steps

Build order is the step order:
- **Milestone A (S1–S3):** shared groundwork, each step its own
  behaviour-neutral commit (`architecture.md` guideline 9).
- **Milestone B (S4–S14):** the pure core, with generation as the priority.
- **Milestone C (S15–S22):** makes the mode playable end to end, with the
  tunable settings and the whole-passage check.
- **Milestone D (S23–S26):** the bonus per-bar review and octave displacement,
  plus playback.

Every step that adds, removes or renames a file the browser loads also adds it
to `sw.js`'s asset list and bumps `CACHE`, in the same change (`architecture.md`
guideline 7). S22 is the final offline check, not the place where files are
listed.

### S1: Move the storage helpers to a shared file

**Covers:** G34, G30
**Files:** `storage.js` (new), `settings.js`, `index.html`, `sw.js`
**Description:** Move `readStored` and `writeStored`, with their comment,
verbatim from `settings.js` into `storage.js`. Load `storage.js` first in
`index.html` and add it to the asset list. Nothing else changes: same names,
same behaviour.
**Rationale:** D13. Guideline 4 lets a file that only relocates chord-trainer
code keep its global names.

### S2: Make the MIDI layer announce to listeners

**Covers:** G34
**Files:** `midi.js`, `ui.js`
**Description:** Give `midi.js` a way for a page to register a listener, and
three announcements: a note was pressed, the held set changed (after any
note-on, note-off, sustain release or panic), and the Reset button was pressed.
Move everything the chord trainer owns out of `midi.js` into `ui.js`:
`compareChord`, `midiCheckMatch`, `redrawPiano`, the practice advance-timer
call, and clearing `practicePeakHeld` on Reset. The chord trainer then
registers one listener that does exactly what `midi.js` did before, in the same
order. `midi.js` keeps the connection, held notes, sustain, idle timeout, Reset,
the held-notes readout, `midiNoteName` and the raw log. An idle-timeout panic
announces a held-set change but not a Reset, so it still leaves
`practicePeakHeld` alone, as today.
**Rationale:** D5. The split between "held set changed" and "Reset pressed" is
what keeps the chord trainer working exactly as before: today only the button
clears the practice peak.

### S3: Teach audio.js to play a timed list of notes

**Covers:** G14, G34
**Files:** `audio.js`
**Description:** Pull the existing two-oscillator tone into one private voice
that both capabilities use. `playChord` must sound exactly as before. Add
playback of a list of notes, each with a MIDI number, a start time and a
duration in seconds. A note's release follows its duration instead of the
chord's fixed 2.5 s decay. It returns a way to stop playback early, which
silences every scheduled voice.
**Rationale:** D7. One tone definition for the whole app.

### S4: Spelled pitch

**Covers:** G3, G29
**Files:** `sequence/core/pitch.js` (new, exposes `SequencePitch`)
**Description:** A spelled pitch is a letter, a numeric alteration (−2 to +2)
and an octave. Provide: its diatonic step (for staff position and interval
size), its MIDI number, the diatonic and chromatic interval between two
pitches, transposition by a diatonic step within a scale, and a readable
label. There is no conversion from a MIDI number to a spelling, anywhere.
**Rationale:** D10 and guideline 2 of `SequenceMode.architecture.md`.

### S5: Keys, scales and chords

**Covers:** G2, G3, G4
**Files:** `sequence/core/theory.js` (new, exposes `SequenceTheory`)
**Description:**
- **Keys:** the 15 major and 15 minor key signatures, with their sharp or flat
  count, and the spelled scale of each key.
- **Triads from a Roman numeral in a key:** major keys use the major scale;
  minor keys use natural minor, except V and vii°, which take the raised 7th.
- **Minor melody notes:** for a stepwise right-hand note, the 6th and 7th are
  raised when the line rises and natural when it falls. Over a chord containing
  a 7th degree, the melody uses that chord's version.
- **Displayed accidentals:** for one bar of spelled notes in a key, which
  accidental each note displays. One is shown when the note differs from the
  key signature or from an earlier note on the same staff position in that
  bar, naturals included.

**Rationale:** as reworded in the framework. The accidental-display rule lives
in the core so it is testable; the notation adapter only draws what it is told.

### S6: Meter

**Covers:** G7, G8
**Files:** `sequence/core/meter.js` (new, exposes `SequenceMeter`)
**Description:** Durations are counted in eighths: eighth 1, quarter 2, dotted
quarter 3, half 4, dotted half 6. For 4/4 (8 eighths) and 3/4 (6 eighths),
define the bar length, which positions are strong beats (4/4: beats 1 and 3;
3/4: beat 1), which positions start a beat, and how eighths group for beaming
(in pairs within each quarter beat). This is the only place meter is defined
(guideline 11); rhythm, left-hand patterns and the notation adapter all read it.

### S7: Passage model

**Covers:** G9, G10, G26
**Files:** `sequence/core/passage.js` (new, exposes `SequencePassage`)
**Description:** Define the passage data as in `SequenceMode.architecture.md`.
It holds a format version, key, time signature, the left-hand pattern used,
and the chord of each bar. Each of the four bars holds right-hand and
left-hand events: notes (spelled pitch and duration), chords (several spelled
pitches, one duration) and rests. Each event has a start position in eighths.
Provide: the list of groups (all notes, both hands, that start at the same bar
and position, in passage order), the bar of each group, and a validity check
used when a stored passage is read back. The staff of each note is stored for
drawing only.

### S8: Difficulty parameters and presets

**Covers:** G15, G28, G29
**Files:** `sequence/core/difficulty.js` (new, exposes `SequenceDifficulty`)
**Description:** Define the full set of tunable parameters, their allowed
limits, the four presets, and a check that reports when a group has nothing
selectable. Every weight runs from 0 to 100, and a weight of 0 means "never".

| Group | Parameters |
|---|---|
| Keys | weight for major, weight for minor; a weight for each count of sharps or flats, 0 to 7 (a count covers both sides, e.g. 2 = D major and B♭ major) |
| Progressions | on/off and weight per template (S9) |
| Rhythm (right hand) | weight per value: half, dotted half, quarter, dotted quarter, eighth, rest |
| Melody intervals | weight per interval from the previous note: repeat, step, 3rd, 4th, 5th, 6th |
| Weak-beat notes | weight for chord tone, passing tone, neighbour tone |
| Left hand | on/off and weight per pattern |
| Ranges | lowest and highest note for each hand |

Ranges are hard limits. The left hand never goes above B3 and the right hand
never below C4, compared by diatonic step, so the clef boundary holds whatever
the spelling. Each range spans at least an octave and lies inside MIDI 21–108.

Presets, as starting points:

| | Beginner | Elementary | Intermediate | Advanced |
|---|---|---|---|---|
| Sharps or flats with weight | 0–1 | 0–2 | 0–4 | 0–7 |
| Minor | 0 | 40 | 50 | 50 |
| Rhythm values with weight | half, quarter | + eighth | + dotted, rests | all, eighths heavier |
| Intervals with weight | repeat, step, 3rd | + 4th | + 5th | + 6th, 4th and 5th heavier |
| Passing / neighbour | passing only | both | both | both |
| Right-hand range | C4–G5 | C4–A5 | C4–C6 | C4–E6 |
| Left-hand range | C3–B3 | A2–B3 | F2–B3 | C2–B3 |
| Patterns on | block, root–fifth | + broken, waltz | + Alberti | all |

Sevenths are never written, whatever the settings.
**Rationale:** guideline 6 as amended. Presets are rows of data, and the
generator only ever sees parameter values.

### S9: Progressions and key choice

**Covers:** G2
**Files:** `sequence/core/progressions.js` (new, exposes `SequenceProgressions`)
**Description:** Four-bar templates, one chord per bar, as Roman numerals.
Major: I–V–vi–IV, I–IV–V–I, I–vi–IV–V, ii–V–I–I, I–vi–ii–V. Minor: i–iv–V–i,
i–VI–III–VII, ii°–V–i–i, i–VI–iv–V. Key choice is three weighted picks:
1. major or minor, by their weights;
2. a sharp-or-flat count, by its weight, then a side, sharps or flats, at
   random (0 and 7 have only one key per side);
3. an enabled template of that mode, by its weight.

All randomness comes from the random source passed in.

### S10: Right-hand rhythm

**Covers:** G6, G7, G8
**Files:** `sequence/core/rhythm.js` (new, exposes `SequenceRhythm`)
**Description:** Hand-written pools of one-bar rhythm cells per time signature,
each a list of durations and rests that fills the bar exactly without hiding a
beat. A separate cadence pool for bar 4 always has a note on beat 1 at least a
quarter long. A cell's weight is the average of its values' weights, and a
cell containing any value weighted 0 is never picked. Bars 1 and 2 pick from
the main pool; bar 3 reuses bar 1's cell; bar 4 picks a cadence cell.
**Rationale:** known-readable cells keep rhythm idiomatic, while value weights
still let the player push towards more eighths, more dotted notes or more
rests. That's the complexity-2 choice.

### S11: Left-hand patterns

**Covers:** G5, G8, G27, G28
**Files:** `sequence/core/accompaniment.js` (new, exposes `SequenceAccompaniment`)
**Description:** Five patterns, each declaring the time signatures it fits.
- **Block chord:** two half-note chords in 4/4, one dotted half in 3/4.
- **Broken chord:** quarter notes through the chord.
- **Alberti bass:** eighths, low–high–middle–high.
- **Waltz bass:** root on beat 1, chord on beats 2 and 3; 3/4 only.
- **Root–fifth:** alternating quarters.

One pattern per passage, picked by weight among the enabled patterns that fit
the time signature. Each bar's chord is voiced in close position inside the
left-hand range. The voicing chosen is the one nearest to the previous bar's,
with no note bound to a control key.
**Rationale:** the one-octave rule in S13 guarantees a close triad always fits,
so voicing never fails once that check passes.

### S12: Right-hand melody

**Covers:** G4, G6, G25, G27, G28
**Files:** `sequence/core/melody.js` (new, exposes `SequenceMelody`)
**Description:** Fill the rhythm with pitches one note at a time. For each note
the candidates are the key's pitches, as spelled by S5, inside the right-hand
range and not bound to a control. They are then filtered by the framework's
melody rules, which are hard rules the weights cannot override:
- strong beats take chord tones;
- a non-chord tone only on a weak beat, and only if the note it obliges next
  (continuing for a passing tone, returning for a neighbour) would itself be
  allowed there;
- no half step above a chord tone, and no 4th over a major chord, on a note on
  a strong beat or at least a quarter long;
- no augmented second, no tritone leap, no 7th;
- leaps only between chord tones, then a step back the other way;
- two large leaps in the same direction only when they outline the chord;
- the leading tone moves up to the tonic;
- no interval whose weight is 0.

Among the survivors, pick by weight: the interval's weight from the previous
note, times the weak-beat weight for chord, passing or neighbour tone, times a
contour weight that favours rising towards the middle of the passage and
falling to the end. Raising the 4th and 5th weights therefore produces more
4ths and 5ths, wherever the rules allow a leap. Bar 4's first note is a chord
tone, the tonic when it is allowed. If nothing survives, take the allowed
chord tone nearest the previous note. A rest clears any pending obligation.

### S13: Generator and range check

**Covers:** G2, G27, G29
**Files:** `sequence/core/generator.js` (new, exposes `SequenceGenerator`)
**Description:** One entry point takes the settings, the set of pitches bound
to controls and a random source. It returns either a passage or a reported
failure, never anything in between. A failure is reported when:
- any weighted group has nothing selectable (S8's check), naming the group;
- a hand's range lacks a run of at least 12 consecutive semitones none of which
  is bound, naming the hand and the colliding bindings.

Otherwise it chooses the key and template (S9), the pattern and left hand
(S11), the rhythm (S10) and the melody (S12), and assembles the passage (S7).

### S14: Whole-passage check

**Covers:** G11, G24, G32
**Files:** `sequence/core/comparison.js` (new, exposes `SequenceComparison`)
**Description:** Given a passage and the played list (MIDI numbers in the order
pressed), count by MIDI number which passage notes came up and which did not,
and which played pitches are not in the passage at all, ignoring order. Counts
matter: a pitch written three times and played once came up once. No hand or
staff appears in the result.

### S15: Vendor VexFlow and write the notation adapter

**Covers:** G3, G9, G17, G31
**Files:** `vendor/vexflow/` (new: library file and its licence), `sequence/shell/notation.js` (new, exposes `SequenceNotation`), `sw.js`, `CLAUDE.md` (H2)
**Description:** Choose a VexFlow build that draws with no network request,
fonts included. Verify it in the browser with the network panel open, then
again with the network disabled. If the chosen build fetches fonts, vendor the
fonts too and point the library at them. If neither is possible, stop and
escalate: D8 is reopened (open question 1 of the feature architecture). The
adapter draws a passage as a grand staff:
- brace, clefs, key signature and time signature on the first bar;
- right-hand and left-hand voices per bar;
- beams grouped by S6;
- accidentals as S5 decides, never VexFlow's own automatic accidentals;
- spacing by duration.

It uses one system of four bars when the container is wide enough, otherwise
two systems of two bars. It redraws on resize and never scrolls. It can also
draw review marks on given notes, as colour plus a mark above the note, so
colour is not the only signal.

### S16: The Sequence Mode page and the links between modes

**Covers:** G1, G16, G17, G34
**Files:** `sequence.html` (new), `sequence/sequence.css` (new), `sequence/shell/page.js` (new, exposes `SequencePage`), `index.html`, `sw.js`
**Description:** `sequence.html` has:
- a header with a link back to the chord trainer and a settings button;
- the controls Generate, Done, Retry and Play;
- a status line for hints and failures;
- the notation area, with an empty-state message before the first passage;
- the review area;
- the same MIDI panel markup as `index.html`, without the chord trainer's
  "Play the chord…" readout.

Scripts load in this order: `storage.js`, `midi.js`, `audio.js`, VexFlow, the
core files in dependency order (pitch, theory, meter, passage, difficulty,
progressions, rhythm, accompaniment, melody, generator, comparison), then the
shell files, with `page.js` last. `page.js` wires everything together and
registers the service worker. `index.html`'s header gains a link to
`sequence.html`. The chord trainer changes in no other way.

### S17: Store

**Covers:** G26, G30
**Files:** `sequence/shell/store.js` (new, exposes `SequenceStore`)
**Description:** It reads and writes two versioned entries through the shared
helpers, under keys of Sequence Mode's own: settings, and the current passage.
Settings missing or unreadable fall back to the Elementary preset. Settings
from an older version go through a converter (none exist yet: version 1). A
passage that fails S7's validity check, or carries another version, is
discarded. The passage is written whenever a new one is generated. An attempt
is never stored.

### S18: State owner

**Covers:** G13, G14, G16, G18, G26
**Files:** `sequence/shell/state.js` (new, exposes `SequenceState`)
**Description:** It holds the state (no passage, passage shown, attempt,
review), the current passage and the played list, and applies only the
framework's transition table. A command not valid in the current state is
ignored. Generate during an attempt, Done or Retry with no attempt, and Play
outside review all do nothing, and their buttons are disabled. A played note
in passage shown starts the attempt and is its first note. Notes in no passage
or review are ignored. Leaving review stops any playback. A generation failure
leaves the state unchanged and shows the failure in the status line. On load,
a restored passage starts in passage shown; nothing restored means no passage.
Until S25 lands, an attempt ends only with Done. Every change redraws the
controls, notation and review from the state.

### S19: Bindings

**Covers:** G15, G24, G27, G33
**Files:** `sequence/shell/bindings.js` (new, exposes `SequenceBindings`)
**Description:** Four commands: generate, done, retry, play. Each has at most
one computer key and one MIDI key. Computer defaults are N, Enter, R and P;
MIDI keys start unbound. It registers a MIDI listener (S2): a pressed note
bound to a command runs the command, any other pressed note goes to the state
owner as a played note. Note-offs, velocity and sustain are ignored, and no
time is recorded. Computer keys are ignored while focus is in a form field or
the settings panel is open. It also provides a learn mode for the settings
panel: the next key pressed becomes the binding; a key already bound to another
command moves to the new one, so no key ever has two commands. The set of
bound MIDI pitches is handed to the generator.

### S20: Settings panel

**Covers:** G5, G15, G30
**Files:** `sequence/shell/settings-panel.js` (new, exposes `SequenceSettingsPanel`), `sequence.html`
**Description:** A modal built like the chord trainer's. It has:
- collapsible groups, each with rows of an on/off checkbox and a 0–100 weight
  slider where the parameter has both, covering every parameter in S8;
- range pickers that enforce S8's limits;
- the time signature;
- playback tempo (quarter = 60 to 120, default 80);
- a preset picker at the top: choosing one fills every parameter, and any edit
  afterwards shows the preset as "Custom";
- the two binding columns, computer and MIDI, side by side, with a learn
  button per command.

Changes save as they are made (S17) and apply to the next passage; bindings
apply at once. Like the chord trainer, it warns in the panel and on the page
when a group has nothing selectable. If the passage on screen contains a pitch
that has just been bound, the status line says so and suggests generating a new
one.

### S21: Review view, whole-passage check

**Covers:** G11
**Files:** `sequence/shell/review.js` (new, exposes `SequenceReview`)
**Description:** In review, show the whole-passage check (S14). The passage's
notes that came up and those that did not are marked on the notation through
the adapter, with a summary of notes not in the passage. Played keys are
labelled with both enharmonic names ("C♯/D♭4"), the way the MIDI panel names
held keys, since a played key has no spelling. That label never feeds back
into the core (feature guideline 2). This is the complete review if milestone
D is dropped.

### S22: Offline check

**Covers:** G31
**Files:** `sw.js` (only if the check finds a file missing)
**Description:** Confirm the asset list holds `sequence.html`,
`sequence/sequence.css`, every `sequence/` script and every vendored VexFlow
file, fonts included if any. Then verify: after one online visit to the chord
trainer only, `sequence.html` loads, draws and generates with the network
disabled, without ever having been opened.

### S23: Alignment and per-bar report (bonus)

**Covers:** G10, G19, G20, G21, G22, G23, G24, G32, G33
**Files:** `sequence/core/comparison.js`
**Description:** Align the played list against the passage's groups with a
small dynamic-programming search. Its state is the position in the played
list, the current group, and which notes of that group are already matched.
At each step a played note either matches an unmatched note of the current
group with the same MIDI number (in any order), or is extra; or the group
closes, and its unmatched notes are missed. Groups after the last match cost
nothing (not attempted). Choose the fewest misses plus extras; break ties
deterministically, preferring a match, then a close, then an extra.
Afterwards:
- a missed note and an extra of the same pitch within one group either side are
  reported together as one note out of order;
- an extra note belongs to the bar of the nearest preceding matched note, or
  bar 1 if none;
- notes after the last matched group are "not attempted", and a bar with none
  attempted is reported as not attempted.

The report per bar holds missed, extra, out-of-order and not-attempted notes,
with no hand or staff in it. Also answer "is the passage complete": every note
of the final group is matched in the best alignment.
**Rationale:** groups are small (at most four notes, so at most 16 match
states) and a passage has at most about 32 groups, so rerunning it after every
note is cheap.

### S24: Octave displacement (bonus)

**Covers:** G12
**Files:** `sequence/core/comparison.js`
**Description:** Also run the alignment with every played note shifted by −2,
−1, +1 and +2 octaves. Report a displacement when the best shift matches at
least half the attempted passage notes, and at least one and a half times as
many as no shift. The report then says once that the attempt was played N
octaves higher or lower, and uses the shifted alignment for everything else.
**Rationale:** the framework's lenient rule, made concrete. Both thresholds are
single constants, for tuning in use.

### S25: Per-bar review and automatic end (bonus)

**Covers:** G10, G12, G18, G20, G32
**Files:** `sequence/shell/review.js`, `sequence/shell/state.js`
**Description:**
- **After each played note,** the state owner reruns the alignment and moves to
  review when the passage is complete (S23). Done still works at any time.
- **The review view** shows the per-bar report: a row per bar listing missed,
  extra, out-of-order and not-attempted notes, labelled as in S21. Missed and
  out-of-order notes are marked on the notation. The octave-displacement line
  appears above the rows when it applies.
- **The whole-passage check** stays available as a second view, one click away.
- **No text names a hand.**

### S26: Playback

**Covers:** G14
**Files:** `sequence/shell/playback.js` (new, exposes `SequencePlayback`)
**Description:** Turn the passage into the timed list S3 plays: MIDI numbers
from the spellings, start and duration from positions and durations at the
tempo setting. Play only when the state owner is in review; Play is not shown
otherwise. Pressing Play while playing restarts; leaving review stops it.

## Helper steps

### H1: Local test page

**Justification:** D4. It checks the core against the acceptance criteria
below, and gives refactors a baseline. Gitignored, never uploaded.
**Files:** `tests.html` (local only)
**Description:** Loads the core files and runs plain assertions with a small
seeded random source defined in the page itself:
- **Theory:** spelling in every key; minor chords and lines.
- **Generator, over a few thousand seeds per preset and time signature:**
  ranges, the clef split, no bound pitch, the melody rules, bar 3's rhythm equal
  to bar 1's, bar 4's first note a chord tone. Also: zero weights never appear,
  and raising the 4th and 5th weights raises how often they occur.
- **Comparison:** the whole-passage check; once milestone D is built, one case
  per framework edge case, plus octave displacement.

It prints a pass or fail list.

### H2: Update CLAUDE.md's Project Context

**Justification:** `architecture.md` guideline 8 ties this to the change that
adds the first vendored library.
**Files:** `CLAUDE.md`
**Description:** In the same change as S15, update the `Rendering` line to say
Sequence Mode draws notation with vendored VexFlow, and the `Dependencies` line
to name it.

## Assumptions

- The right hand plays a single line, one note at a time.
- Chords are triads only; no seventh chords.
- Every bar holds one chord.
- Dotted eighths are excluded: completing their beat needs a sixteenth, which
  is out of scope.
- Several MIDI devices are merged into one stream, as `midi.js` already does.
- The played list is not capped; the alignment stays cheap at any realistic
  length.
- A binding refers to one key; chords of keys as commands are not supported.
- `tests.html` plus playing on a real keyboard is the whole of verification;
  there is no automated pipeline.
- Settings export and import, which the chord trainer has, are not needed here.

## Out of scope

- 6/8 (follow-up plan) and 7/8.
- Ties, sixteenth notes, seventh chords, right-hand chords.
- Scoring, history, adaptive difficulty, timing of any kind.
- Migrating the chord trainer to VexFlow, or any chord-trainer change beyond
  S1, S2 and the link in S16.
- Settings export and import.

## Acceptance criteria

Criteria marked (bonus) belong to milestone D; if it is dropped, they are
dropped with it.

- **G1 satisfied when:** each page has a working link to the other, and
  Sequence Mode's controls appear only on `sequence.html`.
- **G2 satisfied when:** generated passages cover both modes and every key with
  a nonzero weight, and each passage's chords follow one enabled template in its
  key.
- **G3 satisfied when:** the key signature is drawn, and in `tests.html` no note
  inside the key shows an accidental unless an earlier note in the bar altered
  that staff position.
- **G4 satisfied when:** in minor, V and vii° contain the raised 7th and III and
  VII the natural one; rising stepwise lines raise the 6th and 7th, falling ones
  don't, and both match the chord's 7th; no augmented second appears.
- **G5 satisfied when:** each passage uses one pattern throughout, waltz bass
  never appears in 4/4, and a pattern that is the only one enabled is always
  used.
- **G6 satisfied when:** over many seeds, every melody rule in the framework
  holds, bar 3's rhythm equals bar 1's, and interval weights shift how often
  each interval occurs.
- **G7 satisfied when:** only the listed values and rests appear, every bar sums
  exactly, and no note crosses a barline.
- **G8 satisfied when:** 4/4 and 3/4 both generate and draw correctly, and
  compare correctly once milestone D is built.
- **G9 satisfied when:** stems, flags, beams by beat, rests, barlines, time
  signature and duration spacing all draw correctly at both layouts.
- **G10 satisfied when (bonus):** `tests.html` cases for missed, extra and
  out-of-order notes report the right kind in the right bar.
- **G11 satisfied when:** the whole-passage view works on its own at milestone C
  and, if milestone D is built, stays reachable beside the per-bar view.
- **G12 satisfied when (bonus):** a whole passage played an octave up, with two
  slips, reports one displacement plus the two slips.
- **G13 satisfied when:** each row of the transition table works, and every
  other command does nothing.
- **G14 satisfied when:** Play is absent before an attempt ends, and playback
  stops on leaving review.
- **G15 satisfied when:** every parameter is adjustable, presets fill them, each
  change affects the next passage, and both binding columns show side by side
  and work.
- **G16 satisfied when:** a first visit shows the empty-state message and only
  Generate enabled.
- **G17 satisfied when:** all four bars are visible at once at phone and desktop
  widths without scrolling.
- **G18 satisfied when:** Done works at any point of an attempt, and (bonus)
  playing the last group ends the attempt.
- **G19 satisfied when (bonus):** missing one of three repeated pitches reports
  one missed note in that bar.
- **G20 satisfied when (bonus):** ending after bar 2 reports bars 3 and 4 as not
  attempted, not as missed.
- **G21 satisfied when (bonus):** dropping one note mid-passage costs exactly one
  missed note and nothing else.
- **G22 satisfied when (bonus):** a stray C8 in bar 2 is listed as extra in
  bar 2.
- **G23 satisfied when (bonus):** every press order of a group's notes reports no
  error.
- **G24 satisfied when:** holding the sustain pedal throughout changes nothing
  in the review.
- **G25 satisfied when:** generation always returns a passage once the range
  check and the nothing-selectable check pass, across all seeds tried.
- **G26 satisfied when:** a reload shows the same passage in passage shown, and
  a passage stored with another version opens the empty state.
- **G27 satisfied when:** no generated passage contains a bound pitch, and
  binding keys inside a hand's octave reports which bindings collide.
- **G28 satisfied when:** no left-hand note is above B3 and no right-hand note
  below C4, by diatonic step, at any setting.
- **G29 satisfied when:** every generated note lies within MIDI 21–108.
- **G30 satisfied when:** settings survive a reload.
- **G31 satisfied when:** with the network disabled, both pages load, draw and
  play, and the network panel shows no request from VexFlow at any time.
- **G32 satisfied when:** no review text or mark names a hand or staff.
- **G33 satisfied when:** no timestamp is stored with a played note, and the
  same press order gives the same review however slowly it is played.
- **G34 satisfied when:** the chord trainer behaves as before S1 and S2 — live
  readout, practice capture, Reset clearing the practice peak, idle timeout and
  raw log — and Sequence Mode's Reset and raw log work the same way.
