// ═══════════════════════════════════════════════
//  SEQUENCE MODE — RIGHT-HAND RHYTHM (core: pure, no page access)
// ═══════════════════════════════════════════════

// Rhythm comes from hand-written one-bar cells, each known to read clearly: no
// note hides a beat by starting off it and running across it. Tuning the
// rhythm weights changes how likely each cell is, rather than composing
// rhythms note by note — far simpler, and every result stays idiomatic.
//
// Cell notation: e eighth, q quarter, q. dotted quarter, h half, h. dotted
// half; a trailing r makes it a rest (er, qr, hr).
const SequenceRhythm = (() => {
    const TOKEN_VALUES = { e: 'eighth', q: 'quarter', 'q.': 'dottedQuarter', h: 'half', 'h.': 'dottedHalf' };

    const MAIN_CELLS = {
        '4/4': [
            'q q q q', 'h q q', 'q q h', 'h h', 'q q q e e', 'e e q q q', 'q e e q q', 'q q e e q',
            'e e e e q q', 'q q e e e e', 'e e q e e q', 'e e e e e e e e', 'h e e e e', 'e e e e h',
            'q. e q q', 'q q q. e', 'q. e h', 'h q. e', 'q. e q. e', 'h. q',
            'q qr q q', 'h qr q', 'q qr h', 'qr q q q', 'q q q qr', 'e e qr q q', 'h hr',
        ],
        '3/4': [
            'q q q', 'h q', 'q h', 'h.', 'q e e q', 'e e q q', 'q q e e', 'e e e e q', 'q e e e e',
            'e e e e e e', 'q. e q', 'q q. e', 'h e e', 'e e h',
            'q qr q', 'qr q q', 'h qr', 'q q qr', 'e e qr q',
        ],
    };

    // Bar 4 closes the passage, so its first note is on beat 1 and at least a
    // quarter long.
    const CADENCE_CELLS = {
        '4/4': ['h h', 'h. q', 'h q q', 'q q h', 'h hr', 'q. e h', 'h. qr'],
        '3/4': ['h.', 'h q', 'h qr', 'q h', 'q. e q'],
    };

    // A cell as events: { position, duration, value, rest }.
    function parse(cell) {
        let position = 0;
        return cell.split(' ').map(token => {
            const rest = token.endsWith('r');
            const value = TOKEN_VALUES[rest ? token.slice(0, -1) : token];
            const duration = SequenceMeter.DURATIONS[value];
            const event = { position, duration, value, rest };
            position += duration;
            return event;
        });
    }

    // The average weight of the values a cell uses, rests counting as one
    // value; 0 if any of them is weighted out.
    function cellWeight(events, rhythmWeights) {
        const values = new Set(events.map(event => event.rest ? 'rest' : event.value));
        const weights = [...values].map(value => rhythmWeights[value]);
        if (weights.some(weight => weight <= 0)) return 0;
        return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    }

    function choices(cells, rhythmWeights) {
        return cells.map(parse).map(events => ({ item: events, weight: cellWeight(events, rhythmWeights) }));
    }

    function canChoose(timeSignature, rhythmWeights) {
        return [MAIN_CELLS, CADENCE_CELLS].every(pool =>
            choices(pool[timeSignature], rhythmWeights).some(choice => choice.weight > 0));
    }

    // The right hand's rhythm for all four bars: bars 1 and 2 from the main
    // cells, bar 3 repeating bar 1, bar 4 a cadence. Null only when canChoose
    // is false.
    function choose(timeSignature, rhythmWeights, random) {
        const pick = SequenceDifficulty.pick;
        const first = pick(choices(MAIN_CELLS[timeSignature], rhythmWeights), random);
        const second = pick(choices(MAIN_CELLS[timeSignature], rhythmWeights), random);
        const cadence = pick(choices(CADENCE_CELLS[timeSignature], rhythmWeights), random);
        if (first === null || second === null || cadence === null) return null;
        // Bar 3 gets its own copy of bar 1's events, so nothing that later marks
        // or changes one note of a passage can reach a note in another bar.
        return [first, second, first.map(event => ({ ...event })), cadence];
    }

    return { MAIN_CELLS, CADENCE_CELLS, parse, canChoose, choose };
})();
