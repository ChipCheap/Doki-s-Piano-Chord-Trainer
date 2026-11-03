// ═══════════════════════════════════════════════
//  SEQUENCE MODE — LEFT-HAND PATTERNS (core: pure, no page access)
// ═══════════════════════════════════════════════

// One pattern plays through the whole passage. Each bar's chord is voiced in
// close position inside the left-hand range, as near as possible to the
// previous bar's voicing, and never on a key bound to a control. Pattern ids
// are the keys difficulty.js tunes them under.
const SequenceAccompaniment = (() => {
    // A pattern's bar, from a voicing (three pitches, low to high), as events
    // { position, duration, pitches }. Notes are picked by voicing index:
    // 0 low, 1 middle, 2 high.
    const note = (position, duration, voicing, ...indices) =>
        ({ position, duration, pitches: indices.map(index => voicing[index]) });

    const PATTERNS = {
        block: {
            timeSignatures: ['4/4', '3/4'],
            rootPosition: false,
            bar: (voicing, timeSignature) => timeSignature === '4/4'
                ? [note(0, 4, voicing, 0, 1, 2), note(4, 4, voicing, 0, 1, 2)]
                : [note(0, 6, voicing, 0, 1, 2)],
        },
        rootFifth: {
            timeSignatures: ['4/4', '3/4'],
            rootPosition: true,
            bar: (voicing, timeSignature) => timeSignature === '4/4'
                ? [note(0, 2, voicing, 0), note(2, 2, voicing, 2), note(4, 2, voicing, 0), note(6, 2, voicing, 2)]
                : [note(0, 2, voicing, 0), note(2, 2, voicing, 2), note(4, 2, voicing, 2)],
        },
        broken: {
            timeSignatures: ['4/4', '3/4'],
            rootPosition: false,
            bar: (voicing, timeSignature) => timeSignature === '4/4'
                ? [note(0, 2, voicing, 0), note(2, 2, voicing, 1), note(4, 2, voicing, 2), note(6, 2, voicing, 1)]
                : [note(0, 2, voicing, 0), note(2, 2, voicing, 1), note(4, 2, voicing, 2)],
        },
        waltz: {
            timeSignatures: ['3/4'],
            rootPosition: true,
            bar: voicing => [note(0, 2, voicing, 0), note(2, 2, voicing, 1, 2), note(4, 2, voicing, 1, 2)],
        },
        alberti: {
            timeSignatures: ['4/4', '3/4'],
            rootPosition: false,
            bar: (voicing, timeSignature) => {
                const order = [0, 2, 1, 2, 0, 2, 1, 2].slice(0, SequenceMeter.meter(timeSignature).barLength);
                return order.map((index, position) => note(position, 1, voicing, index));
            },
        },
    };

    function choices(patternTuning, timeSignature) {
        return Object.entries(PATTERNS).map(([id, pattern]) => {
            const tuning = patternTuning[id];
            const fits = pattern.timeSignatures.includes(timeSignature);
            return { item: id, weight: fits && tuning.enabled ? tuning.weight : 0 };
        });
    }

    function canChoose(patternTuning, timeSignature) {
        return choices(patternTuning, timeSignature).some(choice => choice.weight > 0);
    }

    function choosePattern(patternTuning, timeSignature, random) {
        return SequenceDifficulty.pick(choices(patternTuning, timeSignature), random);
    }

    // ── Voicing ───────────────────────────────
    // Staff-step offsets above the bass for root position and the two
    // inversions of a close triad.
    const INVERSION_OFFSETS = [[0, 2, 4], [0, 2, 5], [0, 3, 5]];
    const MIDI_LOWEST = 21;
    const MIDI_HIGHEST = 108;

    function voicings(key, chordInKey, range, boundMidi, rootPosition) {
        const tones = SequenceTheory.chordTones(key, chordInKey);
        const alterationOf = letter => tones.find(tone => tone.letter === letter).alteration;
        const result = [];
        INVERSION_OFFSETS.forEach((offsets, inversion) => {
            if (rootPosition && inversion > 0) return;
            const bassLetter = tones[inversion].letter;
            for (let bass = range.low; bass + offsets[2] <= range.high; bass++) {
                if (SequencePitch.fromStep(bass, 0).letter !== bassLetter) continue;
                const pitches = offsets.map(offset => {
                    const natural = SequencePitch.fromStep(bass + offset, 0);
                    return SequencePitch.create(natural.letter, alterationOf(natural.letter), natural.octave);
                });
                const playable = pitches.every(pitch => {
                    const midi = SequencePitch.midi(pitch);
                    return midi >= MIDI_LOWEST && midi <= MIDI_HIGHEST && !boundMidi.has(midi);
                });
                if (playable) result.push(pitches);
            }
        });
        return result;
    }

    // The voicing whose notes move least from `previous` — or, for the first
    // bar, sit nearest the middle of the range.
    function nearest(candidates, previous, range) {
        const centre = (range.low + range.high) / 2;
        const distance = voicing => previous
            ? voicing.reduce((sum, pitch, i) => sum + Math.abs(SequencePitch.midi(pitch) - SequencePitch.midi(previous[i])), 0)
            : Math.abs(SequencePitch.diatonicStep(voicing[1]) - centre);
        return candidates.reduce((best, candidate) => distance(candidate) < distance(best) ? candidate : best);
    }

    // The left hand for every bar, or null when some chord has no playable
    // voicing in the range — which only bound keys inside it can cause. A
    // pattern built on the root (root–fifth, waltz) falls back to an inverted
    // voicing when the range is too narrow for root position, rather than
    // failing: the presets' left-hand ranges reach down to F2, which always
    // has room, but a hand-tuned range may not.
    function accompany(key, chords, patternId, timeSignature, range, boundMidi) {
        const pattern = PATTERNS[patternId];
        const bars = [];
        let previous = null;
        for (const chordInKey of chords) {
            let candidates = voicings(key, chordInKey, range, boundMidi, pattern.rootPosition);
            if (candidates.length === 0 && pattern.rootPosition) {
                candidates = voicings(key, chordInKey, range, boundMidi, false);
            }
            if (candidates.length === 0) return null;
            previous = nearest(candidates, previous, range);
            bars.push(pattern.bar(previous, timeSignature));
        }
        return bars;
    }

    return { PATTERNS, canChoose, choosePattern, accompany };
})();
