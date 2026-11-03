// ═══════════════════════════════════════════════
//  SEQUENCE MODE — SPELLED PITCH (core: pure, no page access)
// ═══════════════════════════════════════════════

// A pitch is spelled: a letter, a numeric alteration (−2 double flat … +2
// double sharp) and an octave, as plain data so a passage can be stored as is.
// The spelling is the source of truth. A MIDI number is derived from it for
// comparing against the keyboard and for playback; nothing ever turns a MIDI
// number back into a spelling, because B♯3 and C4 share one.
const SequencePitch = (() => {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
    const ALTERATION_SYMBOLS = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '♯♯' };
    // The keys the app accepts from MIDI: A0 to C8, an 88-key piano.
    const MIDI_LOWEST = 21;
    const MIDI_HIGHEST = 108;

    function create(letter, alteration, octave) {
        return { letter, alteration, octave };
    }

    // One step per staff line or space, accidentals ignored. C4 is 28.
    function diatonicStep(pitch) {
        return pitch.octave * 7 + LETTERS.indexOf(pitch.letter);
    }

    // The natural pitch on a given staff step, before any alteration.
    function fromStep(step, alteration) {
        const letterIndex = ((step % 7) + 7) % 7;
        return create(LETTERS[letterIndex], alteration, Math.floor(step / 7));
    }

    // C4 = 60.
    function midi(pitch) {
        return (pitch.octave + 1) * 12 + LETTER_SEMITONES[LETTERS.indexOf(pitch.letter)] + pitch.alteration;
    }

    // Signed staff steps from one pitch to the other: a second is 1, an octave 7.
    function diatonicInterval(from, to) {
        return diatonicStep(to) - diatonicStep(from);
    }

    function semitones(from, to) {
        return midi(to) - midi(from);
    }

    function equals(first, second) {
        return first.letter === second.letter && first.alteration === second.alteration &&
               first.octave === second.octave;
    }

    function label(pitch) {
        return pitch.letter + ALTERATION_SYMBOLS[pitch.alteration] + pitch.octave;
    }

    return { LETTERS, MIDI_LOWEST, MIDI_HIGHEST, create, diatonicStep, fromStep, midi, diatonicInterval, semitones, equals, label };
})();
