// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PROGRESSIONS & KEY CHOICE (core: pure, no page access)
// ═══════════════════════════════════════════════

// Four-bar templates, one chord per bar, as Roman numerals. Their ids are the
// keys difficulty.js tunes them under.
const SequenceProgressions = (() => {
    const TEMPLATES = [
        { mode: 'major', numerals: ['I', 'V', 'vi', 'IV'] },
        { mode: 'major', numerals: ['I', 'IV', 'V', 'I'] },
        { mode: 'major', numerals: ['I', 'vi', 'IV', 'V'] },
        { mode: 'major', numerals: ['ii', 'V', 'I', 'I'] },
        { mode: 'major', numerals: ['I', 'vi', 'ii', 'V'] },
        { mode: 'minor', numerals: ['i', 'iv', 'V', 'i'] },
        { mode: 'minor', numerals: ['i', 'VI', 'III', 'VII'] },
        { mode: 'minor', numerals: ['ii°', 'V', 'i', 'i'] },
        { mode: 'minor', numerals: ['i', 'VI', 'iv', 'V'] },
    ].map(template => ({ ...template, id: template.numerals.join('–') }));

    function templateChoices(parameters, mode) {
        return TEMPLATES.filter(template => template.mode === mode).map(template => {
            const tuning = parameters.progressions[template.id];
            return { item: template, weight: tuning.enabled ? tuning.weight : 0 };
        });
    }

    // A mode with no usable template cannot be chosen, whatever its weight.
    function modeWeight(parameters, mode) {
        return templateChoices(parameters, mode).some(choice => choice.weight > 0) ? parameters.modes[mode] : 0;
    }

    function canChoose(parameters) {
        return ['major', 'minor'].some(mode => modeWeight(parameters, mode) > 0) &&
               parameters.signatures.some(value => value > 0);
    }

    // Three weighted picks: the mode, then how many sharps or flats (and at
    // random which of the two), then a template in that mode. Null only when
    // canChoose is false.
    function choose(parameters, random) {
        const pick = SequenceDifficulty.pick;
        const mode = pick(['major', 'minor'].map(item => ({ item, weight: modeWeight(parameters, item) })), random);
        const count = pick(parameters.signatures.map((weight, item) => ({ item, weight })), random);
        if (mode === null || count === null) return null;
        const signature = count === 0 || random() < 0.5 ? count : -count;
        const key = SequenceTheory.KEYS.find(candidate => candidate.mode === mode && candidate.signature === signature);
        const template = pick(templateChoices(parameters, mode), random);
        return { key, template };
    }

    return { TEMPLATES, canChoose, choose };
})();
