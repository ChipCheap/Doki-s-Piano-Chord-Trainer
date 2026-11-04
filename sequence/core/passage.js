// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PASSAGE MODEL (core: pure, no page access)
// ═══════════════════════════════════════════════

// The passage is the single source of truth: notation, playback, comparison
// and storage all read this one plain-data shape, and none keeps its own copy.
//
//   { version, key, timeSignature, pattern,
//     bars: [{ chord, right: [event…], left: [event…] }, …four bars] }
//
// An event is { position, duration, pitches }: position and duration in
// eighths (see meter.js), pitches the spelled pitches sounding — one for a
// note, several for a chord, none for a rest. `right` and `left` are the two
// staves, kept apart only so they can be drawn; comparison never asks which
// hand a note belongs to.
const SequencePassage = (() => {
    // Bumped whenever the shape changes. A stored passage with any other
    // version is discarded rather than converted: a new one costs nothing.
    const VERSION = 1;
    const BAR_COUNT = 4;

    function create(key, timeSignature, pattern, bars) {
        return { version: VERSION, key, timeSignature, pattern, bars };
    }

    // Everything that starts at the same moment, both hands together, in the
    // order written. Rests start nothing, so they form no group.
    function groups(passage) {
        const result = [];
        passage.bars.forEach((bar, barIndex) => {
            const byPosition = new Map();
            for (const event of [...bar.right, ...bar.left]) {
                if (event.pitches.length === 0) continue;
                if (!byPosition.has(event.position)) byPosition.set(event.position, []);
                byPosition.get(event.position).push(...event.pitches);
            }
            [...byPosition.keys()].sort((first, second) => first - second).forEach(position =>
                result.push({ bar: barIndex, position, pitches: byPosition.get(position) }));
        });
        return result;
    }

    // ── Validity of stored data ───────────────
    // A passage read back from storage is checked whole before it is used, so
    // nothing downstream has to defend against a malformed one: every value is
    // of the right kind, every hard rule a generated passage keeps holds, and
    // the key, chords and pattern are ones the generator could have chosen.
    const RIGHT_LOWEST_STEP = 28;
    const LEFT_HIGHEST_STEP = 27;
    const CHORD_SIZE = 3;
    // Only the lengths the generator writes, so everything that draws or plays
    // a passage knows every length it can meet.
    const NOTE_LENGTHS = Object.values(SequenceMeter.DURATIONS);

    function isPitch(value) {
        if (value === null || typeof value !== 'object' || !SequencePitch.LETTERS.includes(value.letter) ||
            !Number.isInteger(value.alteration) || value.alteration < -2 || value.alteration > 2 ||
            !Number.isInteger(value.octave)) return false;
        const midi = SequencePitch.midi(value);
        return midi >= SequencePitch.MIDI_LOWEST && midi <= SequencePitch.MIDI_HIGHEST;
    }

    // One staff of one bar: events back to back filling the bar, every pitch
    // valid and on the hand's own side of middle C, at most `mostPitches` at once.
    function isStaff(events, barLength, mostPitches, onItsSide) {
        if (!Array.isArray(events)) return false;
        let expected = 0;
        for (const event of events) {
            if (event === null || typeof event !== 'object' || event.position !== expected ||
                !NOTE_LENGTHS.includes(event.duration) ||
                !Array.isArray(event.pitches) || event.pitches.length > mostPitches ||
                !event.pitches.every(pitch => isPitch(pitch) && onItsSide(SequencePitch.diatonicStep(pitch)))) return false;
            expected += event.duration;
        }
        return expected === barLength;
    }

    function isValid(value) {
        if (value === null || typeof value !== 'object' || value.version !== VERSION) return false;
        const meter = SequenceMeter.TIME_SIGNATURES[value.timeSignature];
        const stored = value.key;
        if (!meter || stored === null || typeof stored !== 'object' || !stored.tonic) return false;
        const key = SequenceTheory.KEYS.find(candidate => candidate.mode === stored.mode &&
            candidate.signature === stored.signature && candidate.tonic.letter === stored.tonic.letter &&
            candidate.tonic.alteration === stored.tonic.alteration);
        const pattern = SequenceAccompaniment.PATTERNS[value.pattern];
        if (!key || !pattern || !pattern.timeSignatures.includes(value.timeSignature)) return false;
        if (!Array.isArray(value.bars) || value.bars.length !== BAR_COUNT) return false;

        const numerals = value.bars.map(bar => bar !== null && typeof bar === 'object' && bar.chord ? bar.chord.numeral : null);
        const fromTemplate = SequenceProgressions.TEMPLATES.some(template => template.mode === key.mode &&
            JSON.stringify(template.numerals) === JSON.stringify(numerals));
        if (!fromTemplate) return false;
        return value.bars.every(bar =>
            JSON.stringify(bar.chord) === JSON.stringify(SequenceTheory.chord(key, bar.chord.numeral)) &&
            isStaff(bar.right, meter.barLength, 1, step => step >= RIGHT_LOWEST_STEP) &&
            isStaff(bar.left, meter.barLength, CHORD_SIZE, step => step <= LEFT_HIGHEST_STEP));
    }

    return { VERSION, create, groups, isValid };
})();
