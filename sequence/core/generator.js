// ═══════════════════════════════════════════════
//  SEQUENCE MODE — GENERATOR (core: pure, no page access)
// ═══════════════════════════════════════════════

// The one entry point that turns settings into a passage. It returns either
// { passage } or { failure }. Settings that cannot produce a passage are
// reported up front by `problems`, which the settings panel also uses to warn
// before anything is generated. A passage always keeps the hard rules —
// ranges, the clef split, no bound key; only the melody's last-resort
// fallback, reached when bound keys leave no line at all, may bend a melody
// rule.
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
        return { message, keys: keys || [] };
    }

    // Why these settings cannot produce a passage, or null if they can.
    // settings: { parameters, timeSignature } — parameters as difficulty.js
    // describes them. boundMidi: the keys bound to controls.
    function problems(settings, boundMidi) {
        const { parameters, timeSignature } = settings;
        if (!SequenceMeter.TIME_SIGNATURES[timeSignature]) return failure('Unknown time signature: ' + timeSignature + '.');

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
        return null;
    }

    // random: () → [0, 1).
    function generate(settings, boundMidi, random) {
        const problem = problems(settings, boundMidi);
        if (problem) return { failure: problem };
        const { parameters, timeSignature } = settings;

        const { key, template } = SequenceProgressions.choose(parameters, random);
        const chords = template.numerals.map(numeral => SequenceTheory.chord(key, numeral));
        const patternId = SequenceAccompaniment.choosePattern(parameters.patterns, timeSignature, random);
        const left = SequenceAccompaniment.accompany(key, chords, patternId, timeSignature, parameters.leftRange, boundMidi);
        if (!left) {
            return { failure: failure('The left hand cannot voice every chord around the control bindings in its range:',
                                      freeRun(parameters.leftRange, boundMidi).inside) };
        }
        const rhythm = SequenceRhythm.choose(timeSignature, parameters.rhythm, random);
        const right = SequenceMelody.compose({ key, chords, rhythm, timeSignature, parameters, boundMidi }, random);
        if (!right) {
            return { failure: failure('The right hand cannot find chord tones around the control bindings in its range:',
                                      freeRun(parameters.rightRange, boundMidi).inside) };
        }

        const bars = chords.map((chordInKey, bar) => ({ chord: chordInKey, right: right[bar], left: left[bar] }));
        return { passage: SequencePassage.create(key, timeSignature, patternId, bars) };
    }

    return { problems, generate };
})();
