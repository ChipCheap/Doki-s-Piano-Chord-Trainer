// ═══════════════════════════════════════════════
//  SEQUENCE MODE — GENERATOR (core: pure, no page access)
// ═══════════════════════════════════════════════

// The one entry point that turns settings into a passage. It returns either
// { passage } or { failure }, never anything in between: a passage that could
// only be made by breaking a rule is reported, not produced.
//
// A failure is { message, keys }: a sentence for the player, and the MIDI
// numbers of the bound keys involved, if any, for the page to name.
const SequenceGenerator = (() => {
    const FREE_RUN_NEEDED = 12;

    // The longest run of consecutive keys, none bound, inside a hand's range,
    // and the bound keys that fall inside the range.
    function freeRun(range, boundMidi) {
        const low = SequencePitch.midi(SequencePitch.fromStep(range.low, 0));
        const high = SequencePitch.midi(SequencePitch.fromStep(range.high, 0));
        let longest = 0, current = 0;
        const inside = [];
        for (let midi = low; midi <= high; midi++) {
            if (boundMidi.has(midi)) { inside.push(midi); current = 0; } else longest = Math.max(longest, ++current);
        }
        return { longest, inside };
    }

    function failure(message, keys) {
        return { failure: { message, keys: keys || [] } };
    }

    // settings: { parameters, timeSignature } — parameters as difficulty.js
    // describes them. boundMidi: the keys bound to controls. random: () → [0, 1).
    function generate(settings, boundMidi, random) {
        const { parameters, timeSignature } = settings;

        const empty = SequenceDifficulty.emptyGroups(parameters);
        if (empty.length) return failure('Nothing is selectable in: ' + empty.join(', ') + '.');
        if (!SequenceProgressions.canChoose(parameters)) {
            return failure('No key can be chosen: every mode with weight is missing an enabled progression.');
        }
        if (!SequenceRhythm.canChoose(timeSignature, parameters.rhythm)) {
            return failure('No ' + timeSignature + ' rhythm fits the rhythm weights; try allowing half or quarter notes.');
        }
        if (!SequenceAccompaniment.canChoose(parameters.patterns, timeSignature)) {
            return failure('No enabled left-hand pattern fits ' + timeSignature + '.');
        }
        for (const [hand, range] of [['right', parameters.rightRange], ['left', parameters.leftRange]]) {
            const { longest, inside } = freeRun(range, boundMidi);
            if (longest < FREE_RUN_NEEDED) {
                return failure('The ' + hand + '-hand range has less than an octave of keys free of control ' +
                               'bindings. Move these bindings or widen the range:', inside);
            }
        }

        const { key, template } = SequenceProgressions.choose(parameters, random);
        const chords = template.numerals.map(numeral => SequenceTheory.chord(key, numeral));
        const patternId = SequenceAccompaniment.choosePattern(parameters.patterns, timeSignature, random);
        const left = SequenceAccompaniment.accompany(key, chords, patternId, timeSignature, parameters.leftRange, boundMidi);
        if (!left) {
            return failure('The left hand cannot voice every chord around the control bindings in its range:',
                           freeRun(parameters.leftRange, boundMidi).inside);
        }
        const rhythm = SequenceRhythm.choose(timeSignature, parameters.rhythm, random);
        const right = SequenceMelody.compose({ key, chords, rhythm, timeSignature, parameters, boundMidi }, random);
        if (!right) {
            return failure('The right hand cannot find chord tones around the control bindings in its range:',
                           freeRun(parameters.rightRange, boundMidi).inside);
        }

        const bars = chords.map((chordInKey, bar) => ({ chord: chordInKey, right: right[bar], left: left[bar] }));
        return { passage: SequencePassage.create(key, timeSignature, patternId, bars) };
    }

    return { generate };
})();
