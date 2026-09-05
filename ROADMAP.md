# Roadmap

Things known to be missing or worth improving, kept out of the main README so
it stays about using the app.

## Scale-aware accidentals

Right now every altered note carries its own accidental, because a chord is
spelled in isolation with no key context. Real sheet music puts the recurring
alterations in a key signature and only marks departures from it, using a
natural sign where a note returns to the unaltered pitch.

Doing this needs, roughly in order:

- a key/scale selection (the chord alone is not enough to imply one)
- a key signature drawn after the clef
- accidental suppression for notes already covered by the signature
- natural signs where a note contradicts the signature — this is what
  `Natural.png` is for. It is currently unused; the flat glyph is `B.png`.

## Display

- Other styling options / themes.
- A grand staff closer to real piano sheet music: proper stems and beams,
  correct notehead spacing, and a bar structure rather than a single chord
  parked between two barlines.

## Practice

- Per-session statistics beyond the results strip (accuracy over time, which
  chord types are consistently missed).
- Keyboard navigation for the results strip.
