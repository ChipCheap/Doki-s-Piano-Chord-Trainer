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
            [...byPosition.keys()].sort((a, b) => a - b).forEach(position =>
                result.push({ bar: barIndex, position, pitches: byPosition.get(position) }));
        });
        return result;
    }

    // ── Validity of stored data ───────────────
    // A passage read back from storage is checked whole before it is used, so
    // nothing downstream has to defend against a malformed one.
    function isPitch(value) {
        return value !== null && typeof value === 'object' &&
               SequencePitch.LETTERS.includes(value.letter) &&
               Number.isInteger(value.alteration) && value.alteration >= -2 && value.alteration <= 2 &&
               Number.isInteger(value.octave);
    }

    function isStaff(events, barLength) {
        if (!Array.isArray(events)) return false;
        let expected = 0;
        for (const event of events) {
            if (event === null || typeof event !== 'object' || event.position !== expected ||
                !Number.isInteger(event.duration) || event.duration <= 0 ||
                !Array.isArray(event.pitches) || !event.pitches.every(isPitch)) return false;
            expected += event.duration;
        }
        return expected === barLength;
    }

    function isValid(value) {
        if (value === null || typeof value !== 'object' || value.version !== VERSION) return false;
        const meter = SequenceMeter.TIME_SIGNATURES[value.timeSignature];
        const key = value.key;
        if (!meter || key === null || typeof key !== 'object' || !key.tonic ||
            !SequenceTheory.KEYS.some(candidate => candidate.mode === key.mode &&
                candidate.signature === key.signature && candidate.tonic.letter === key.tonic.letter &&
                candidate.tonic.alteration === key.tonic.alteration)) return false;
        return Array.isArray(value.bars) && value.bars.length === BAR_COUNT && value.bars.every(bar =>
            bar !== null && typeof bar === 'object' && bar.chord !== null && typeof bar.chord === 'object' &&
            isStaff(bar.right, meter.barLength) && isStaff(bar.left, meter.barLength));
    }

    return { VERSION, BAR_COUNT, create, groups, isValid };
})();
