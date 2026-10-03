# Sequence Mode — Design Framework

## Intent

A second mode of the trainer, alongside the existing chord trainer, for
practising **sight-reading** at home.

It generates a short notated passage — four bars over a short chord progression,
with the left hand playing an accompaniment pattern and the right hand playing
the harmony decorated with passing and neighbour tones in varied rhythm. You
read it and play it. Afterwards the app tells you what you got wrong.

The governing sentence, in the user's words:

> It is never supposed to replace a real teacher, only a tool for home practice.

That is the justification for everything this mode deliberately does *not* do:
no timing analysis, no hand attribution, no scoring. It generates material worth
reading and reports honestly on what was played. Judgement stays with the player.

**Success** is being able to produce unfamiliar four-bar material indefinitely,
at a difficulty you choose, with feedback precise enough that reading improves
over months of use.

## Scope

### In

- A distinct mode reached by its own tab, with its own controls.
- Four-bar passages over a short chord progression drawn from common templates
  (I–V–vi–IV, ii–V–I and similar), built diatonically in a key.
- The key is **derived from the progression's opening chord**, never asked for.
- Left hand plays one accompaniment pattern per passage, from a small set of
  standard figures (block chord, broken chord, Alberti bass, waltz bass,
  root–fifth).
- Right hand plays chord tones decorated with passing tones (stepwise notes
  filling the gap between chord tones) and neighbour tones (a step away and
  back).
- Rhythm: half, quarter and eighth notes, their dotted forms, and rests.
- Time signatures introduced as a ladder: **4/4 first, then 3/4, then 6/8, then
  7/8** — see Open Questions on 7/8.
- Full rhythmic notation: stems, flags, beamed groups, rests, barlines, time
  signature, duration-based horizontal spacing.
- Post-attempt review by aligning the played note stream against the expected
  one, attributed per bar.
- Octave displacement recognised and reported as a single error.
- Retry the same passage, or generate a new one — both explicit actions.
- Playback of the passage, available only once an attempt has finished.
- Mode-specific settings: difficulty, time signature, left-hand pattern, and
  remappable control bindings for both computer keyboard and MIDI keyboard.

### Out

- **Any evaluation of timing or tempo.** No metronome grading, no clock, no
  judgement of whether a note was early or late.
- **Hand attribution in feedback.** MIDI carries no hand information and the
  mode will not guess.
- Scoring, grading or progress metrics beyond per-bar error reporting.
- A history of past attempts.
- Ties across barlines, and sixteenth notes.
- Migrating the existing chord trainer to the notation library. That is
  deliberate follow-up work, not part of this feature.

## Design

### States and transitions

```
no passage ──generate──▶ passage shown ──first note played──▶ attempt
                              ▲                                  │
                              │                     done, or alignment
                              │                     reaches the end
                              │                                  ▼
                              └──────────retry──────────────  review
                                                                 │
                                                       generate  ▼
                                                           no passage
```

- The **whole passage is visible from the start.** It never advances, scrolls or
  reveals itself progressively — reading the page is the skill being practised.
- An attempt ends either when the alignment has consumed the whole passage, or
  when the player ends it manually. The manual exit always exists.
- **Review** reports, per bar: notes missed, notes played that were not in the
  passage, and notes played out of order. If every pitch class matched under a
  uniform octave shift, that is reported once as a single octave displacement
  rather than as a page of wrong notes.
- **Retry** replays the same passage from the start, discarding the previous
  attempt. **Generate** produces new material.

### Why alignment rather than matching

The played stream is compared to the expected stream the way a text diff
compares two files. This buys three things that exact matching cannot:

1. Position in the passage without any timing information, which is what makes
   per-bar attribution possible at all.
2. Graceful degradation when the input drops or corrupts a note — a diff absorbs
   a missing element, where exact matching derails and never recovers.
3. A principled distinction between *missed*, *extra* and *out of order*.

### Surface

- The passage, notated.
- Controls for generate, done and retry; playback appears only after an attempt.
- Settings for difficulty, time signature, left-hand pattern, and the control
  bindings for both input methods, presented side by side.

### Relationship to existing features

- **Reuses** the MIDI input layer, including its reset control and raw message
  log, and the existing audio playback.
- **Does not reuse** the chord trainer's randomiser settings. Those weights were
  designed for drilling single chords and do not map onto progressions.
- **Does not disturb** the chord trainer. Both modes coexist, with different
  renderers, until the migration is taken up separately.

## Edge cases

| Case | Decided behaviour |
|---|---|
| Passage played correctly but an octave off | Detected and reported once as octave displacement, not as every note wrong |
| The same pitch repeats and one is missed | Reported as one missing instance in that bar. Which instance cannot be determined without timing — an accepted limit of alignment |
| Player gives up partway | Manual end; review covers what was played, remaining bars reported as not attempted |
| Input drops or corrupts a note | Alignment absorbs it; the attempt continues rather than derailing |
| Extra notes far outside the passage | Reported as extra notes in the bar where they occurred |
| Page reloaded mid-attempt | Passage is restored; the attempt resets to the start |
| A control binding collides with the generator's range | The generator must not produce that pitch. If the remaining range is too small to generate in, the player is told rather than silently given degenerate passages |
| Hand would cross the clef boundary | Never generated — see invariants |
| Playback requested before an attempt | Not offered |

## Boundaries & invariants

**Always:**

1. The whole passage is visible from the moment it is generated.
2. The key is derived from the music, never required as user input. The mode
   must be usable by someone who does not read key signatures.
3. A manual way to end an attempt always exists, so a stalled attempt can
   always be closed.
4. Left-hand material stays within the bass staff; right-hand material stays
   within the treble staff.
5. Generated pitches stay inside the range the app already accepts from MIDI.
6. Settings persist across sessions.
7. The app continues to work offline and to install as a PWA.

**Never:**

1. Feedback never claims which hand made an error. MIDI does not carry that
   information and the mode will not guess at it.
2. Timing is never evaluated. Neither tempo, duration nor lateness is judged.
3. A hand never crosses the clef boundary in generated material.
4. The generator never produces a pitch bound to a control key.
5. Playback is never available before an attempt has finished — hearing the
   passage first turns sight-reading into learning by ear.
6. A dependency is never added that requires a build step or a network fetch at
   runtime.

## Relation to project framework

No project-wide `framework.md` exists. This feature instead inherits the
constraints recorded under `## Project Context` in `CLAUDE.md`: vanilla
JavaScript with no build step, hand-rolled rendering, offline-first PWA, and
dependencies permitted only when vendored and build-free.

**One of those is consciously stretched.** Full rhythmic notation — beaming,
flags, rests, duration-based spacing — is large enough that a notation library
(VexFlow was named) is intended here rather than hand-rolled drawing. This
stays inside the project constraint only because such a library can be vendored
as a plain script with no build step and cached by the service worker. How it
is adopted is an architecture decision, not a framework one.

The consequence to accept: until the chord trainer is migrated, the two modes
will not look alike.

## Standards adopted

**Accepted:**

- Settings persisted locally, consistent with the existing mode.
- Offline-first preserved; any library vendored into the repository.
- An empty state before the first passage is generated.
- Remappable controls for both computer and MIDI keyboards, because keyboard
  sizes differ and a fixed binding would be unusable on a short keyboard.
- Honest failure reporting rather than silent degradation.

**Deliberately rejected:**

- A session history strip, as the chord trainer has. A four-bar review is far
  larger than a chord thumbnail and would not fit the same pattern.
- Adaptive difficulty. It needs stored history, and unreliable input would make
  it behave unpredictably.
- Timed grading, for the reason in the Intent.

## Open questions

Each with a recommended default, to be settled at specification time or later.

1. **Is 7/8 worth building?** It is rare in the beginner-to-intermediate piano
   repertoire this mode targets, the standard left-hand patterns do not map onto
   it naturally, and it requires choosing and notating a beat grouping
   (2+2+3, 3+2+2 or 2+3+2). *Default: treat as a stretch goal and re-justify it
   when 6/8 is done, rather than committing now.*
2. **Beaming and grouping conventions for compound and asymmetric meters.**
   6/8 beams eighths in threes and has a dotted beat; 7/8 needs an explicit
   grouping. *Default: research before building beyond 3/4.*
3. **Which left-hand patterns ship first.** *Default: block chord, broken chord
   and Alberti bass for 4/4; add waltz bass with 3/4.*
4. **How difficulty maps onto generation.** One control has to drive rhythmic
   density, interval size, accidental count, range and position shifts together.
   *Default: a small number of named levels with hand-tuned parameters, rather
   than a continuous scale.*
5. **When the chord trainer migrates to the notation library,** and whether the
   current hand-drawn look is reproduced or deliberately replaced. *Default:
   revisit once this mode has proven the library in practice.*
6. **What counts as too little range** when control bindings squeeze the
   generator on a short keyboard. *Default: warn when fewer than three octaves
   remain available.*
