// ═══════════════════════════════════════════════
//  SEQUENCE MODE — RIGHT-HAND MELODY (core: pure, no page access)
// ═══════════════════════════════════════════════

// The melody is chosen one note at a time, and only ever from notes that
// already obey the melody rules: nothing is generated and then thrown away.
// The rules are hard; the difficulty weights only decide among what survives.
//
// Some choices oblige the next note — a passing tone continues by step, a
// neighbour returns, a large leap steps back, the leading tone over the
// dominant chord rises to the tonic — and a note near the edge of the range can leave the next chord out
// of reach. So a note is offered only if the rest of the passage can still be
// completed from it under the same rules. That question is answered once per
// position and situation and remembered, which keeps it exact and fast.
const SequenceMelody = (() => {
    const INTERVAL_NAMES = ['repeat', 'step', 'third', 'fourth', 'fifth', 'sixth'];
    // The semitone sizes each staff distance may have. Anything else is
    // augmented or diminished — the augmented second and the tritone among
    // them — and is never written. A 7th or wider has no entry at all.
    const PLAIN_SIZES = [[0], [1, 2], [3, 4], [5], [7], [8, 9]];
    const LARGE_LEAP = 3;
    // More of the same pitch in a row than this stops reading as a melody.
    const MOST_IN_A_ROW = 3;
    // The leading tone only pulls to the tonic as part of the dominant
    // harmony; elsewhere a line may walk down through it, as C–B–A does.
    const DOMINANT_NUMERALS = ['V', 'vii°'];
    const TONIC_PREFERENCE = 4;
    const MIDI_LOWEST = 21;
    const MIDI_HIGHEST = 108;

    // The obligations a state carries forward, cleared by a rest or a fallback.
    const RELEASED = { requiredStep: null, mustResolve: false, leapDirection: 0, leapFrom: null, leapsInARow: 0 };

    function compose(context, random) {
        const { key, chords, rhythm, timeSignature, parameters, boundMidi } = context;
        const range = parameters.rightRange;
        const notes = rhythm.flatMap((events, bar) => events.map(event => ({ ...event, bar })));
        const tones = chords.map(chordInKey => SequenceTheory.chordTones(key, chordInKey));

        // How many notes sound before each position, for the contour.
        const soundingBefore = [];
        notes.reduce((count, note, index) => { soundingBefore[index] = count; return count + (note.rest ? 0 : 1); }, 0);
        const sounding = notes.filter(note => !note.rest).length;

        const isChordTone = (bar, pitch) => tones[bar].some(tone =>
            tone.letter === pitch.letter && tone.alteration === pitch.alteration);
        const isTonic = pitch => pitch.letter === key.tonic.letter && pitch.alteration === key.tonic.alteration;
        const isLeadingTone = pitch => {
            const tonicAbove = SequencePitch.create(key.tonic.letter, key.tonic.alteration, pitch.octave +
                (SequencePitch.LETTERS.indexOf(key.tonic.letter) <= SequencePitch.LETTERS.indexOf(pitch.letter) ? 1 : 0));
            return SequenceTheory.degreeOf(key, pitch.letter) === 6 && SequencePitch.semitones(pitch, tonicAbove) === 1;
        };
        const playable = pitch => {
            const midi = SequencePitch.midi(pitch);
            return midi >= MIDI_LOWEST && midi <= MIDI_HIGHEST && !boundMidi.has(midi);
        };

        // The spelling of a staff step at this point. A note repeated on the
        // same letter keeps its spelling unless the chord says otherwise.
        function spell(step, bar, previous) {
            const natural = SequencePitch.fromStep(step, 0);
            const previousStep = previous ? SequencePitch.diatonicStep(previous) : null;
            const inChord = tones[bar].some(tone => tone.letter === natural.letter);
            if (previous && previousStep === step && !inChord) {
                return SequencePitch.create(natural.letter, previous.alteration, natural.octave);
            }
            const direction = previous ? Math.sign(step - previousStep) : 0;
            return SequencePitch.create(natural.letter,
                SequenceTheory.melodyAlteration(key, chords[bar], natural.letter, direction), natural.octave);
        }

        // The line rises towards the middle of the passage and falls to its end.
        function contour(index, step) {
            const progress = sounding > 1 ? soundingBefore[index] / (sounding - 1) : 0;
            const span = range.high - range.low;
            const target = range.low + span * (0.3 + 0.45 * Math.sin(Math.PI * progress));
            const spread = Math.max(2, span / 4);
            return Math.exp(-((step - target) ** 2) / (2 * spread ** 2));
        }

        // A note at least a quarter long, or on a strong beat, carries weight:
        // no half step above a chord tone, and no 4th over a major chord.
        function avoidedWhenLong(bar, pitch) {
            const midi = SequencePitch.midi(pitch);
            const classOf = tone => SequencePitch.midi(SequencePitch.create(tone.letter, tone.alteration, 4));
            const aboveChordTone = tones[bar].some(tone => (midi - classOf(tone) + 120) % 12 === 1);
            const [root, third] = tones[bar];
            const major = (classOf(third) - classOf(root) + 12) % 12 === 4;
            const fourthAboveRoot = SequenceTheory.degreeOf(key, pitch.letter) ===
                (SequenceTheory.degreeOf(key, root.letter) + 3) % 7;
            return aboveChordTone || (major && fourthAboveRoot);
        }

        // Every way note `index` may be played after `state` under the rules,
        // each with its weight and the state it leaves behind.
        function candidates(index, state) {
            const note = notes[index];
            const strong = SequenceMeter.isStrong(timeSignature, note.position);
            const long = note.duration >= SequenceMeter.LONG_NOTE;
            const previous = state.previous;
            const result = [];

            for (let step = range.low; step <= range.high; step++) {
                // The one way out of a large leap other than stepping back is a
                // second leap the same way that outlines the chord, checked below.
                const continuesLeap = !state.mustResolve && state.leapDirection !== 0 &&
                    Math.sign(step - SequencePitch.diatonicStep(previous)) === state.leapDirection &&
                    Math.abs(step - SequencePitch.diatonicStep(previous)) >= LARGE_LEAP;
                if (state.requiredStep !== null && step !== state.requiredStep && !continuesLeap) continue;
                const pitch = spell(step, note.bar, previous);
                if (!playable(pitch)) continue;

                let intervalWeight = 100;
                let size = 0;
                let direction = 0;
                if (previous) {
                    const distance = step - SequencePitch.diatonicStep(previous);
                    size = Math.abs(distance);
                    if (size >= PLAIN_SIZES.length) continue;
                    if (!PLAIN_SIZES[size].includes(Math.abs(SequencePitch.semitones(previous, pitch)))) continue;
                    intervalWeight = parameters.intervals[INTERVAL_NAMES[size]];
                    if (intervalWeight <= 0) continue;
                    direction = Math.sign(distance);
                }

                const repeatRun = previous && SequencePitch.equals(previous, pitch) ? state.repeatRun + 1 : 1;
                if (repeatRun > MOST_IN_A_ROW) continue;

                const chordTone = isChordTone(note.bar, pitch);
                if (strong && !chordTone) continue;

                // Large leaps run between chord tones and are followed by a
                // step back — unless a second leap the same way outlines the
                // chord with the first.
                const requirements = [];
                let leapFrom = null;
                if (size >= LARGE_LEAP) {
                    if (!chordTone || !state.previousIsChordTone) continue;
                    // A third large leap the same way is never allowed.
                    if (state.leapDirection === direction && state.leapsInARow >= 2) continue;
                    if (state.leapDirection === direction) {
                        const outlines = state.leapFrom && isChordTone(note.bar, state.leapFrom) &&
                            isChordTone(note.bar, previous) &&
                            Math.abs(step - SequencePitch.diatonicStep(state.leapFrom)) <= 7;
                        if (!outlines) continue;
                    }
                    leapFrom = previous;
                    requirements.push({ step: step - direction, mustResolve: false });
                }
                if (isLeadingTone(pitch) && DOMINANT_NUMERALS.includes(chords[note.bar].numeral)) {
                    requirements.push({ step: step + 1, mustResolve: true });
                }

                const kinds = [];
                if (chordTone) {
                    kinds.push({ kind: 'chordTone', requirement: null });
                } else {
                    // Approached by step from the note just before, so never straight after a rest.
                    if (!previous || state.afterRest || size !== 1 || (long && avoidedWhenLong(note.bar, pitch))) continue;
                    // A neighbour steps away from a chord tone and back to it. A
                    // passing tone runs from a chord tone towards the next, and
                    // may follow another passing tone only going the same way.
                    const continuesPassing = state.previousKind === 'passing' && state.previousDirection === direction;
                    if (state.previousIsChordTone || continuesPassing) {
                        kinds.push({ kind: 'passing', requirement: { step: step + direction, mustResolve: true } });
                    }
                    if (state.previousIsChordTone) {
                        kinds.push({ kind: 'neighbour', requirement: { step: step - direction, mustResolve: true } });
                    }
                }

                for (const { kind, requirement } of kinds) {
                    const all = requirement ? [...requirements, requirement] : requirements;
                    const steps = new Set(all.map(entry => entry.step));
                    if (steps.size > 1) continue;
                    const beatWeight = strong ? 100 : parameters.weakBeats[kind];
                    if (beatWeight <= 0) continue;

                    const next = {
                        previous: pitch, previousIsChordTone: chordTone, previousKind: kind,
                        previousDirection: direction, afterRest: false, repeatRun,
                        requiredStep: steps.size ? [...steps][0] : null,
                        mustResolve: all.some(entry => entry.mustResolve),
                        leapDirection: size >= LARGE_LEAP ? direction : 0, leapFrom,
                        leapsInARow: size < LARGE_LEAP ? 0 : (state.leapDirection === direction ? state.leapsInARow + 1 : 1),
                    };
                    const firstOfCadence = note.bar === chords.length - 1 && note.position === 0;
                    const tonicWeight = firstOfCadence && isTonic(pitch) ? TONIC_PREFERENCE : 1;
                    result.push({ pitch, state: next,
                                  weight: intervalWeight * beatWeight * contour(index, step) * tonicWeight });
                }
            }
            return result;
        }

        // Whether the passage can be finished from position `index` in
        // `state`. A rest releases every obligation, but a passing or
        // neighbour tone or a leading tone may not hang before a rest or at the
        // end. Remembered per position and state, so each is worked out once.
        const completable = new Map();
        function canComplete(index, state) {
            if (index === notes.length) return !state.mustResolve;
            const memoKey = index + '|' + stateKey(state);
            if (completable.has(memoKey)) return completable.get(memoKey);
            let result;
            if (notes[index].rest) {
                result = !state.mustResolve && canComplete(index + 1, { ...state, ...RELEASED, afterRest: true });
            } else {
                result = candidates(index, state).some(candidate => canComplete(index + 1, candidate.state));
            }
            completable.set(memoKey, result);
            return result;
        }

        function stateKey(state) {
            const label = pitch => pitch ? SequencePitch.label(pitch) : '-';
            return [label(state.previous), state.previousIsChordTone, state.previousKind, state.previousDirection,
                    state.afterRest, state.repeatRun,
                    state.requiredStep, state.mustResolve, state.leapDirection, label(state.leapFrom),
                    state.leapsInARow].join(',');
        }

        // Only reached when no line at all fits — bound keys crowding the
        // range: the playable chord tone nearest the previous note, preferring
        // one that is neither a leading tone, nor reached by an interval the
        // rules never write, nor one repeat too many, with every obligation
        // released.
        function nearestChordTone(note, state) {
            const previous = state.previous;
            const anchor = previous ? SequencePitch.midi(previous) : SequencePitch.midi(SequencePitch.fromStep(range.low + 2, 0));
            const cost = pitch => {
                let penalty = isLeadingTone(pitch) ? 1000 : 0;
                if (previous && SequencePitch.equals(previous, pitch) && state.repeatRun >= MOST_IN_A_ROW) penalty += 500;
                if (previous) {
                    const size = Math.abs(SequencePitch.diatonicInterval(previous, pitch));
                    const plain = size < PLAIN_SIZES.length &&
                        PLAIN_SIZES[size].includes(Math.abs(SequencePitch.semitones(previous, pitch)));
                    if (!plain) penalty += 100;
                }
                return penalty + Math.abs(SequencePitch.midi(pitch) - anchor);
            };
            let best = null;
            for (let step = range.low; step <= range.high; step++) {
                const pitch = spell(step, note.bar, previous);
                if (!playable(pitch) || !isChordTone(note.bar, pitch)) continue;
                if (!best || cost(pitch) < cost(best)) best = pitch;
            }
            return best;
        }

        let state = { previous: null, previousIsChordTone: false, previousKind: null, previousDirection: 0,
                      afterRest: false, repeatRun: 0, ...RELEASED };
        const chosen = [];
        for (let index = 0; index < notes.length; index++) {
            const note = notes[index];
            if (note.rest) {
                state = { ...state, ...RELEASED, afterRest: true };
                chosen.push(null);
                continue;
            }
            const choices = candidates(index, state)
                .filter(candidate => canComplete(index + 1, candidate.state))
                .map(candidate => ({ item: candidate, weight: candidate.weight }));
            const choice = SequenceDifficulty.pick(choices, random);
            if (choice) {
                chosen.push(choice.pitch);
                state = choice.state;
            } else {
                const fallback = nearestChordTone(note, state);
                if (!fallback) return null;
                chosen.push(fallback);
                const repeatRun = state.previous && SequencePitch.equals(state.previous, fallback) ? state.repeatRun + 1 : 1;
                state = { previous: fallback, previousIsChordTone: true, previousKind: 'chordTone', previousDirection: 0,
                          afterRest: false, repeatRun, ...RELEASED };
            }
        }

        let cursor = 0;
        return rhythm.map(events => events.map(event => {
            const pitch = chosen[cursor++];
            return { position: event.position, duration: event.duration, pitches: pitch ? [pitch] : [] };
        }));
    }

    return { compose };
})();
