# Sequence Mode — the music theory behind the generator

This is a summary, for a piano teacher to check, of the rules the app follows
when it writes a four-bar sight-reading passage. Each section says what the
rule is, why it was chosen, and where it lives in the code, with a short
excerpt. Nothing here is graded: the app only writes material and reports which
notes were played.

Comments, corrections and "that's not how it's usually done" are exactly what
this document is for. The open questions at the end are the places where a
teacher's judgement would help most.

---

## 1. Notes are spelled by letter first, never worked out from the key pressed

**Rule.** Every note is spelled the way it would be written: a letter (C–B), an
accidental and an octave. The spelling comes from the key and the chord, never
from which piano key it sounds on. The number of the piano key is only worked
out afterwards, to compare against what was played and to play the passage
back.

**Why.** A♭ and G♯ are the same key on the piano but different notes on the
page. In F minor the notes are F G A♭ B♭ C D♭ E♭, so its third is always A♭,
never G♯: the letter A comes from the scale, and the key signature makes it
flat. Spelling from the letter means the generator can never write G♯ in F minor
by accident. It's the same principle as the chord trainer, which spells chords
from their interval numbers.

**Where.** `sequence/core/pitch.js` (a pitch is letter + alteration + octave)
and `sequence/core/theory.js`.

```js
// pitch.js — the key number is derived from the spelling, never the reverse
function midi(pitch) {
    return (pitch.octave + 1) * 12 + LETTER_SEMITONES[LETTERS.indexOf(pitch.letter)] + pitch.alteration;
}
```

---

## 2. Keys and key signatures

**Rule.** All 15 major and 15 minor key signatures are available, from seven
flats to seven sharps. The generator picks major or minor, then how many sharps
or flats (by the difficulty settings), then which side at random. A minor key
uses the same signature as its relative major, so A minor has none.

**Why.** Key choice is a difficulty knob. Fewer accidentals in the signature
makes easier reading.

**Where.** `theory.js`, the key table; `progressions.js`, the choice.

---

## 3. Chords: four-bar progressions of triads

**Rule.** Each passage uses one of these four-bar templates, one chord per bar.
All chords are triads (root, third, fifth).

| Major | Minor |
|---|---|
| I–V–vi–IV | i–iv–V–i |
| I–IV–V–I | i–VI–III–VII |
| I–vi–IV–V | ii°–V–i–i |
| ii–V–I–I | i–VI–iv–V |
| I–vi–ii–V | |

**Minor keys.** Chords are built from natural minor, **except V and vii°, which
take the raised 7th** (in A minor: E–G♯–B and G♯–B–D). III and VII keep the
natural 7th (C–E–G and G–B–D), because i–VI–III–VII needs it.

**Why.** The raised 7th is what makes the dominant pull back to the tonic.
Strict harmonic minor everywhere would turn VII into G♯–B–D, which is not the
chord of that progression.

```js
// theory.js — only the dominant chords raise the 7th in minor
const raisedSeventh = key.mode === 'minor' && (numeral === 'V' || numeral === 'vii°');
```

---

## 4. Spelling the 6th and 7th in a minor-key melody

**Rule.** A melody note that belongs to the chord underneath is spelled as the
chord spells it. For the 6th and 7th degrees that are *not* in the chord:

- **If the chord holds one of the two, the other takes the same form.** Over V
  (E–G♯–B) the 6th is raised too (F♯). Over iv (D–F–A), VI (F–A–C) or ii° (B–D–F)
  the 7th stays natural too (G). Over III and VII, with a natural G in the chord,
  the 6th stays natural (F).
- **Over i, where the chord holds neither, the line follows melodic minor by
  where it goes next:** raised when it carries on upwards (E–F♯–G♯–A), natural
  when it comes down (A–G–F–E). A neighbour note is spelled by the note it
  returns to: E–F–E (comes back down, so natural) and A–G♯–A (comes back up, so
  raised).

**Why.** Mixing a raised 7th with a natural 6th, or the reverse, gives the
augmented second F–G♯, which is awkward to read and avoided in melodies. Making
the two agree removes it without banning common lines such as F–G–A over iv.

```js
// theory.js — the 6th and 7th travel together
const partner = tones.find(candidate => candidate.letter === partnerLetter);
const raised = partner ? partner.alteration > signatureAlteration(key, partnerLetter) : onward > 0;
```

---

## 5. Which accidentals are printed

**Rule.** The key signature is printed. A note shows an accidental only when it
differs from the signature, or from an earlier accidental on the same line or
space in the same bar. Naturals are shown when a note returns to the signature
within a bar. An accidental lasts until the barline and applies only to its own
octave.

**Where.** `theory.js`, `displayedAccidentals`.

---

## 6. Metre and rhythm

**Rule.**
- **4/4:** strong beats are 1 and 3. **3/4:** beat 1. Eighths are beamed in
  pairs within each beat.
- The right hand's rhythm comes from a hand-written list of one-bar patterns,
  each chosen to read clearly (no note starting off the beat and running across
  it).
- Values used: half, dotted half, quarter, dotted quarter, eighth, and rests.
  Dotted eighths are not used, since completing their beat needs a sixteenth.
- **Bar 3 repeats bar 1's rhythm** with new notes.
- **Bar 4 opens with a note at least a quarter long.**

**Why.** Repeating a rhythm is what makes generated music read as composed. A
list of known-good bars keeps the rhythm idiomatic, while the difficulty weights
still decide how often each value appears.

**Where.** `meter.js`, `rhythm.js`.

---

## 7. The left hand

**Rule.** One pattern per passage:
- **block chord:** two half-note chords in 4/4, one dotted half in 3/4;
- **broken chord:** quarters through the chord;
- **Alberti bass:** low–high–middle–high in eighths;
- **waltz bass:** root, then chord, chord; 3/4 only;
- **root–fifth:** alternating quarters.

Chords are in close position, always within the bass staff (never above B3),
and each is voiced as close as possible to the previous bar's. Waltz bass and
root–fifth sit on the chord's root whenever the range allows.

**Why.** Small movements from chord to chord are how a pianist's left hand
actually moves.

**Where.** `accompaniment.js`.

---

## 8. The right-hand melody

The melody is written one note at a time. At every step the generator only
chooses among notes that obey all of the rules below; it never writes a melody
and then checks it. The difficulty settings only change *how likely* each
allowed note is, never whether a rule applies. Rules marked † are deliberate
choices a teacher may want to question.

1. **Strong beats take chord tones.**
2. **Passing and neighbour tones fall on weak beats only.** They are approached
   and left by step, never straight after a rest.
   - A neighbour steps away from a chord tone and back to the same note.
   - A passing tone runs from a chord tone towards the next, and only another
     passing tone in the same direction may follow it.
3. **On a long note (a quarter or longer), no non-chord tone a half step above
   a chord tone, and no 4th above the root of a major chord.** These clash most
   when held.
4. **No augmented or diminished intervals**, so no augmented second and no
   tritone leap. **Nothing wider than a 6th.**
5. **Leaps of a 4th, 5th or 6th go from chord tone to chord tone, and the next
   note steps back the other way.** A second large leap in the same direction is
   allowed only if the two together outline the chord within an octave
   (C–G–C); never a third. †
6. **Over V and vii°, the leading tone must rise to the tonic.** Elsewhere a
   line may walk down through it (C–B–A). † One consequence: over V in minor, a
   line can't fall G♯–F♯–E, because G♯ must go up to A.
7. **No note more than three times in a row.** †
8. **Shape:** the line tends to rise towards the middle of the passage and fall
   towards the end.
9. **Ending:** bar 4 opens on a chord tone, with the tonic four times as likely
   as any other note. It's preferred, not forced, because some templates end on
   IV or V, which don't contain the tonic.

```js
// melody.js — the semitone sizes each staff distance may have; anything else
// is augmented or diminished and is never written
const PLAIN_SIZES = [[0], [1, 2], [3, 4], [5], [7], [8, 9]];
//                   unison 2nd   3rd   4th 5th  6th
```

**Why so strict?** The aim is material that reads like real beginner and
intermediate piano music, so a student learns patterns that transfer to real
pieces. Only rules that are standard in teaching melody writing were taken.

---

## 9. Difficulty

Every choice above that is a matter of taste is a tunable weight (0–100):
- how often major vs minor, and each number of sharps or flats;
- each progression;
- each rhythm value and rests;
- each melody interval (repeat, step, 3rd, 4th, 5th, 6th);
- chord, passing or neighbour tone on weak beats;
- each left-hand pattern;
- each hand's range.

Four presets (Beginner → Advanced) are starting points only. For example,
turning up the 4th and 5th weights makes those leaps more frequent, within the
leap rules.

---

## 10. Questions for a teacher

1. **Parallel octaves and fifths between the hands are not checked.** The left
   hand and the melody are written independently, apart from sharing the chord.
   Does this matter for sight-reading material, or only for composition?
2. **Is the leading-tone rule (rule 6) right**: forced only over V and vii°, free
   elsewhere?
3. **Are the four-bar templates sensible?** They have no cadential 6/4, no
   secondary dominants and no seventh chords yet.
4. **Is "no more than three repeats" a good limit?** At Beginner, about a third
   of melody notes are still repeats, because with only halves and quarters on
   mostly strong beats and nothing wider than a 3rd, there is often no other
   move.
5. **Two leaps the same way only when they outline the chord** (rule 5): too
   strict, or about right?
6. **Neighbour spelling in minor** (section 4): is E–F–E and A–G♯–A over i what
   you would expect to see?
