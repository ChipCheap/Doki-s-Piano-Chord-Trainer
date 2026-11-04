// ═══════════════════════════════════════════════
//  SEQUENCE MODE — KEYS, SCALES & CHORDS (core: pure, no page access)
// ═══════════════════════════════════════════════

// A key is { tonic, mode, signature }: the tonic as a spelled pitch class
// ({ letter, alteration }, no octave), 'major' or 'minor', and the signature
// as a signed count — positive sharps, negative flats. A minor key's signature
// spells natural minor; the raised 6th and 7th come in as accidentals.
const SequenceTheory = (() => {
    const LETTERS = SequencePitch.LETTERS;
    const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

    // Tonics by signature, from seven flats to seven sharps.
    const MAJOR_TONICS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const MINOR_TONICS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

    function pitchClass(name) {
        const alteration = name.length === 1 ? 0 : (name[1] === '#' ? 1 : -1);
        return { letter: name[0], alteration };
    }

    const KEYS = [];
    for (let signature = -7; signature <= 7; signature++) {
        KEYS.push({ tonic: pitchClass(MAJOR_TONICS[signature + 7]), mode: 'major', signature });
        KEYS.push({ tonic: pitchClass(MINOR_TONICS[signature + 7]), mode: 'minor', signature });
    }

    // The alteration the key signature gives a letter.
    function signatureAlteration(key, letter) {
        if (key.signature > 0) return SHARP_ORDER.indexOf(letter) < key.signature ? 1 : 0;
        if (key.signature < 0) return FLAT_ORDER.indexOf(letter) < -key.signature ? -1 : 0;
        return 0;
    }

    // Scale degree of a letter in the key: 0 is the tonic, 6 the 7th.
    function degreeOf(key, letter) {
        return (LETTERS.indexOf(letter) - LETTERS.indexOf(key.tonic.letter) + 7) % 7;
    }

    function letterOfDegree(key, degree) {
        return LETTERS[(LETTERS.indexOf(key.tonic.letter) + degree) % 7];
    }

    // ── Chords ────────────────────────────────
    // A chord is { numeral, degree, raisedSeventh }. In minor only the dominant
    // chords, V and vii°, raise the 7th: that raised 7th is what pulls back to
    // the tonic. III and VII keep it natural, as i–VI–III–VII needs.
    const NUMERAL_DEGREES = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

    function chord(key, numeral) {
        const degree = NUMERAL_DEGREES[numeral.replace('°', '').toUpperCase()];
        const raisedSeventh = key.mode === 'minor' && (numeral === 'V' || numeral === 'vii°');
        return { numeral, degree, raisedSeventh };
    }

    // The alteration a letter takes inside a chord, the raised 7th included.
    function chordAlteration(key, chordInKey, letter) {
        const raise = chordInKey.raisedSeventh && degreeOf(key, letter) === 6;
        return signatureAlteration(key, letter) + (raise ? 1 : 0);
    }

    // Root, third and fifth as spelled pitch classes.
    function chordTones(key, chordInKey) {
        return [0, 2, 4].map(offset => {
            const letter = letterOfDegree(key, chordInKey.degree + offset);
            return { letter, alteration: chordAlteration(key, chordInKey, letter) };
        });
    }

    function isChordTone(key, chordInKey, pitch) {
        return chordTones(key, chordInKey).some(tone =>
            tone.letter === pitch.letter && tone.alteration === pitch.alteration);
    }

    // ── Melody spelling ───────────────────────
    // The alteration a right-hand note on this letter takes over this chord.
    // A letter the chord contains is spelled as the chord spells it, so the
    // melody never clashes with the harmony. In minor the 6th and 7th travel
    // together: when the chord holds one of them, the other takes the same
    // form — both raised over V and vii°, both natural over iv, VI, ii°, III
    // and VII — which keeps the augmented second between them out of the line.
    // When the chord holds neither (i), they follow melodic minor by where the
    // line goes next: raised when it goes on up, natural when it comes down.
    // `onward` is that direction, +1 or −1.
    function melodyAlteration(key, chordInKey, letter, onward) {
        const tones = chordTones(key, chordInKey);
        const tone = tones.find(candidate => candidate.letter === letter);
        if (tone) return tone.alteration;
        const signature = signatureAlteration(key, letter);
        const degree = degreeOf(key, letter);
        if (key.mode !== 'minor' || (degree !== 5 && degree !== 6)) return signature;
        const partnerLetter = letterOfDegree(key, degree === 5 ? 6 : 5);
        const partner = tones.find(candidate => candidate.letter === partnerLetter);
        const raised = partner ? partner.alteration > signatureAlteration(key, partnerLetter) : onward > 0;
        return signature + (raised ? 1 : 0);
    }

    // ── Displayed accidentals ─────────────────
    // For the pitches on one staff in one bar, in the order written: the
    // accidental each one shows, as an alteration (0 is a natural sign), or
    // null for none. One is shown when the note differs from what the key
    // signature, or an earlier accidental on the same staff position in this
    // bar, already makes it.
    function displayedAccidentals(key, pitches) {
        const inForce = new Map();
        return pitches.map(pitch => {
            const step = SequencePitch.diatonicStep(pitch);
            const current = inForce.has(step) ? inForce.get(step) : signatureAlteration(key, pitch.letter);
            if (pitch.alteration === current) return null;
            inForce.set(step, pitch.alteration);
            return pitch.alteration;
        });
    }

    function keyLabel(key) {
        const symbols = { '-1': '♭', '0': '', '1': '♯' };
        return key.tonic.letter + symbols[key.tonic.alteration] + ' ' + key.mode;
    }

    // The chord as a lead-sheet symbol above a bar: the spelled root, then m
    // for minor or ° for diminished — Am, F♯, B°, G𝄪° in A♯ minor.
    const ROOT_ACCIDENTALS = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
    const QUALITY_SUFFIXES = { '4,7': '', '3,7': 'm', '3,6': '°', '4,8': '+' };

    function chordSymbol(key, chordInKey) {
        const tones = chordTones(key, chordInKey);
        const semitone = tone => SequencePitch.midi(SequencePitch.create(tone.letter, tone.alteration, 4));
        const above = tones.slice(1).map(tone => (semitone(tone) - semitone(tones[0]) + 12) % 12).join(',');
        return tones[0].letter + ROOT_ACCIDENTALS[tones[0].alteration] + QUALITY_SUFFIXES[above];
    }

    return {
        KEYS, signatureAlteration, degreeOf, chord, chordTones, isChordTone,
        melodyAlteration, displayedAccidentals, keyLabel, chordSymbol,
    };
})();
