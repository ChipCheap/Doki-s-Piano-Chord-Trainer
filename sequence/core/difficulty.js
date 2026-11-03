// ═══════════════════════════════════════════════
//  SEQUENCE MODE — DIFFICULTY PARAMETERS & PRESETS (core: pure, no page access)
// ═══════════════════════════════════════════════

// Difficulty is a set of plain, tunable parameters — weights from 0 to 100,
// where 0 means "never", and hard limits — in the spirit of the chord
// trainer's randomiser. Presets are only starting points that fill every
// parameter in; the generator reads parameter values and never a preset name.
//
//   modes          { major, minor }                   weight of each mode
//   signatures     [w0 … w7]                          weight per count of sharps or flats
//   progressions   { templateId: { enabled, weight } }
//   rhythm         { half, dottedHalf, quarter, dottedQuarter, eighth, rest }
//   intervals      { repeat, step, third, fourth, fifth, sixth }
//   weakBeats      { chordTone, passing, neighbour }
//   patterns       { patternId: { enabled, weight } }
//   rightRange     { low, high }                      staff steps (see pitch.js)
//   leftRange      { low, high }
//
// Template and pattern ids are the keys progressions.js and
// accompaniment.js define their entries under.
const SequenceDifficulty = (() => {
    const TEMPLATE_IDS = ['I–V–vi–IV', 'I–IV–V–I', 'I–vi–IV–V', 'ii–V–I–I', 'I–vi–ii–V',
                          'i–iv–V–i', 'i–VI–III–VII', 'ii°–V–i–i', 'i–VI–iv–V'];
    const PATTERN_IDS = ['block', 'rootFifth', 'broken', 'waltz', 'alberti'];
    const RHYTHM_VALUES = ['half', 'dottedHalf', 'quarter', 'dottedQuarter', 'eighth', 'rest'];
    const INTERVALS = ['repeat', 'step', 'third', 'fourth', 'fifth', 'sixth'];
    const WEAK_BEAT_KINDS = ['chordTone', 'passing', 'neighbour'];
    const MAX_SIGNATURE = 7;

    // Staff steps: C4 is 28. The right hand never goes below middle C and the
    // left never above the B below it, which is what keeps each hand on its
    // own staff whatever the spelling. The presets start the left hand no
    // higher than F2, the highest start that still fits every chord in root
    // position below B3.
    const STEP = { C1: 7, C2: 14, F2: 17, B3: 27, C4: 28, G5: 39, A5: 40, C6: 42, E6: 44, C7: 49 };
    const RANGE_LIMITS = {
        rightRange: { low: STEP.C4, high: STEP.C7 },
        leftRange:  { low: STEP.C1, high: STEP.B3 },
    };
    // Six steps span seven letters, C3 to B3 say: every letter once, which is
    // what a hand needs to voice any triad and to step anywhere in the scale.
    const MIN_RANGE_STEPS = 6;

    const onlyThese = (ids, enabledIds) => Object.fromEntries(ids.map(id =>
        [id, { enabled: enabledIds.includes(id), weight: 100 }]));
    const weightsFor = (names, values) => Object.fromEntries(names.map((name, i) => [name, values[i]]));
    const signaturesUpTo = most => Array.from({ length: MAX_SIGNATURE + 1 }, (_, count) => count <= most ? 100 : 0);

    const PRESETS = {
        beginner: {
            name: 'Beginner',
            parameters: {
                modes: { major: 100, minor: 0 },
                signatures: signaturesUpTo(1),
                progressions: onlyThese(TEMPLATE_IDS, TEMPLATE_IDS),
                rhythm: weightsFor(RHYTHM_VALUES, [100, 0, 100, 0, 0, 0]),
                intervals: weightsFor(INTERVALS, [20, 100, 60, 0, 0, 0]),
                weakBeats: weightsFor(WEAK_BEAT_KINDS, [100, 60, 0]),
                patterns: onlyThese(PATTERN_IDS, ['block', 'rootFifth']),
                rightRange: { low: STEP.C4, high: STEP.G5 },
                leftRange: { low: STEP.F2, high: STEP.B3 },
            },
        },
        elementary: {
            name: 'Elementary',
            parameters: {
                modes: { major: 100, minor: 40 },
                signatures: signaturesUpTo(2),
                progressions: onlyThese(TEMPLATE_IDS, TEMPLATE_IDS),
                rhythm: weightsFor(RHYTHM_VALUES, [80, 0, 100, 0, 60, 0]),
                intervals: weightsFor(INTERVALS, [15, 100, 60, 40, 0, 0]),
                weakBeats: weightsFor(WEAK_BEAT_KINDS, [100, 60, 40]),
                patterns: onlyThese(PATTERN_IDS, ['block', 'rootFifth', 'broken', 'waltz']),
                rightRange: { low: STEP.C4, high: STEP.A5 },
                leftRange: { low: STEP.F2, high: STEP.B3 },
            },
        },
        intermediate: {
            name: 'Intermediate',
            parameters: {
                modes: { major: 100, minor: 50 },
                signatures: signaturesUpTo(4),
                progressions: onlyThese(TEMPLATE_IDS, TEMPLATE_IDS),
                rhythm: weightsFor(RHYTHM_VALUES, [60, 40, 100, 50, 80, 30]),
                intervals: weightsFor(INTERVALS, [10, 100, 60, 50, 40, 0]),
                weakBeats: weightsFor(WEAK_BEAT_KINDS, [100, 70, 50]),
                patterns: onlyThese(PATTERN_IDS, PATTERN_IDS),
                rightRange: { low: STEP.C4, high: STEP.C6 },
                leftRange: { low: STEP.F2, high: STEP.B3 },
            },
        },
        advanced: {
            name: 'Advanced',
            parameters: {
                modes: { major: 100, minor: 50 },
                signatures: signaturesUpTo(7),
                progressions: onlyThese(TEMPLATE_IDS, TEMPLATE_IDS),
                rhythm: weightsFor(RHYTHM_VALUES, [40, 40, 100, 60, 100, 40]),
                intervals: weightsFor(INTERVALS, [10, 100, 60, 70, 70, 50]),
                weakBeats: weightsFor(WEAK_BEAT_KINDS, [100, 70, 60]),
                patterns: onlyThese(PATTERN_IDS, PATTERN_IDS),
                rightRange: { low: STEP.C4, high: STEP.E6 },
                leftRange: { low: STEP.C2, high: STEP.B3 },
            },
        },
    };
    const DEFAULT_PRESET = 'elementary';

    function presetParameters(presetId) {
        return structuredClone(PRESETS[presetId].parameters);
    }

    // The preset these parameters are exactly, or null once anything was tuned.
    function matchingPreset(parameters) {
        const text = JSON.stringify(sanitize(parameters));
        return Object.keys(PRESETS).find(id => JSON.stringify(PRESETS[id].parameters) === text) || null;
    }

    // ── Weighted choice ───────────────────────
    // Every random decision in generation goes through this, with the random
    // source passed in. Choices weighted 0 are never made; null when every
    // weight is 0.
    function pick(choices, random) {
        const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
        if (total <= 0) return null;
        let remaining = random() * total;
        for (const choice of choices) {
            if (choice.weight <= 0) continue;
            remaining -= choice.weight;
            if (remaining < 0) return choice.item;
        }
        return choices.filter(choice => choice.weight > 0).pop().item;
    }

    // ── Reading stored parameters ─────────────
    // Stored settings may be partial, from an older build, or tampered with.
    // Every value is taken over only if it is valid; anything else keeps the
    // default preset's value, so the result is always complete and in range.
    function weight(value, fallback) {
        return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : fallback;
    }

    function weightTable(stored, defaults) {
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        return Object.fromEntries(Object.entries(defaults).map(([name, fallback]) =>
            [name, weight(source[name], fallback)]));
    }

    function switchTable(stored, defaults) {
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        return Object.fromEntries(Object.entries(defaults).map(([id, fallback]) => {
            const entry = source[id] !== null && typeof source[id] === 'object' ? source[id] : {};
            return [id, {
                enabled: typeof entry.enabled === 'boolean' ? entry.enabled : fallback.enabled,
                weight: weight(entry.weight, fallback.weight),
            }];
        }));
    }

    function range(stored, fallback, limits) {
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        const low = Number.isInteger(source.low) ? source.low : fallback.low;
        const high = Number.isInteger(source.high) ? source.high : fallback.high;
        if (low < limits.low || high > limits.high || high - low < MIN_RANGE_STEPS) return { ...fallback };
        return { low, high };
    }

    function sanitize(stored) {
        const defaults = PRESETS[DEFAULT_PRESET].parameters;
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        const signatures = Array.isArray(source.signatures) ? source.signatures : [];
        return {
            modes: weightTable(source.modes, defaults.modes),
            signatures: defaults.signatures.map((fallback, count) => weight(signatures[count], fallback)),
            progressions: switchTable(source.progressions, defaults.progressions),
            rhythm: weightTable(source.rhythm, defaults.rhythm),
            intervals: weightTable(source.intervals, defaults.intervals),
            weakBeats: weightTable(source.weakBeats, defaults.weakBeats),
            patterns: switchTable(source.patterns, defaults.patterns),
            rightRange: range(source.rightRange, defaults.rightRange, RANGE_LIMITS.rightRange),
            leftRange: range(source.leftRange, defaults.leftRange, RANGE_LIMITS.leftRange),
        };
    }

    // ── Nothing selectable ────────────────────
    // The groups in which every choice is weighted out. Groups whose answer
    // depends on other settings too — a mode with no enabled template, a time
    // signature no enabled pattern fits — are checked by the generator.
    function emptyGroups(parameters) {
        const anyWeight = table => Object.values(table).some(value => value > 0);
        const anySwitch = table => Object.values(table).some(entry => entry.enabled && entry.weight > 0);
        // Rests alone cannot fill a bar, so only the note values count here.
        const noteValues = Object.entries(parameters.rhythm).filter(([value]) => value !== 'rest');
        const empty = [];
        if (!anyWeight(parameters.modes)) empty.push('Keys: major and minor');
        if (!parameters.signatures.some(value => value > 0)) empty.push('Keys: sharps and flats');
        if (!anySwitch(parameters.progressions)) empty.push('Progressions');
        if (!noteValues.some(([, value]) => value > 0)) empty.push('Rhythm');
        if (!anyWeight(parameters.intervals)) empty.push('Melody intervals');
        if (!anyWeight(parameters.weakBeats)) empty.push('Weak-beat notes');
        if (!anySwitch(parameters.patterns)) empty.push('Left-hand patterns');
        return empty;
    }

    return {
        TEMPLATE_IDS, PATTERN_IDS, RHYTHM_VALUES, INTERVALS, WEAK_BEAT_KINDS, MAX_SIGNATURE,
        RANGE_LIMITS, MIN_RANGE_STEPS, PRESETS, DEFAULT_PRESET,
        presetParameters, matchingPreset, pick, sanitize, emptyGroups,
    };
})();
