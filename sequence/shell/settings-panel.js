// ═══════════════════════════════════════════════
//  SEQUENCE MODE — SETTINGS PANEL (shell)
// ═══════════════════════════════════════════════

// A modal built like the chord trainer's: every difficulty parameter as a
// row of checkbox and weight slider in collapsible groups, a preset picker
// that fills them all, the time signature and playback tempo, each hand's
// range, and the control bindings for both input methods side by side.
// Changes apply as they are made; the page saves them and redraws its
// warnings. The panel edits the settings object it is given and nothing else.
const SequenceSettingsPanel = (() => {
    const modal = document.getElementById('settingsModal');
    const body = document.getElementById('spBody');
    const warning = document.getElementById('spWarning');
    let hooks = null;
    let closeTimer = null;
    let presetSelect = null;
    const expanded = new Set(['Passage', 'Controls']);

    const LABELS = {
        modes: { major: 'Major', minor: 'Minor' },
        rhythm: { half: 'Half', dottedHalf: 'Dotted half', quarter: 'Quarter', dottedQuarter: 'Dotted quarter',
                  eighth: 'Eighth', rest: 'Rests' },
        intervals: { repeat: 'Repeated note', step: 'Step (2nd)', third: '3rd', fourth: '4th', fifth: '5th', sixth: '6th' },
        weakBeats: { chordTone: 'Chord tone', passing: 'Passing tone', neighbour: 'Neighbour tone' },
        patterns: { block: 'Block chord', rootFifth: 'Root–fifth', broken: 'Broken chord', waltz: 'Waltz bass (3/4 only)',
                    alberti: 'Alberti bass' },
        commands: { generate: 'Generate', done: 'Done', retry: 'Retry', play: 'Play' },
        methods: { computer: 'Computer key', midi: 'MIDI key' },
    };

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // Any change: keep the preset picker honest, then let the page react.
    function changed() {
        const preset = SequenceDifficulty.matchingPreset(hooks.settings().parameters);
        presetSelect.value = preset || 'custom';
        hooks.changed();
        showWarning();
    }

    function showWarning() {
        const problem = SequenceGenerator.problems(hooks.settings(), hooks.boundMidi());
        warning.hidden = problem === null;
        if (problem) warning.textContent = problem.message + (problem.keys.length ? ' ' + problem.keys.map(midiKeyLabel).join(', ') : '');
    }

    // ── Rows ──────────────────────────────────
    // A slider for the weight entry[field] — a table and one of its names, or
    // a switch entry and 'weight' — with an on/off checkbox when `entry` has
    // `enabled`.
    function weightRow(label, entry, field) {
        const row = element('div', 'enabled' in entry ? 'sp-row' : 'sp-row sq-plain-row');
        const id = 'sq-' + Math.random().toString(36).slice(2);
        if ('enabled' in entry) {
            const checkbox = element('input', 'sp-checkbox');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.checked = entry.enabled;
            checkbox.addEventListener('change', () => { entry.enabled = checkbox.checked; changed(); });
            row.appendChild(checkbox);
        }
        const name = element('label', 'sp-label', label);
        name.htmlFor = id;
        const value = element('span', 'sp-weight-val', entry[field] + '%');
        const slider = element('input', 'sp-slider');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = entry[field];
        slider.id = 'enabled' in entry ? id + '-weight' : id;
        slider.setAttribute('aria-label', label + ' weight');
        slider.addEventListener('input', () => {
            entry[field] = Number(slider.value);
            value.textContent = slider.value + '%';
            changed();
        });
        row.append(name, value, slider);
        return row;
    }

    // Rows for a table of plain weights, { name: weight }.
    function weightRows(table, labels) {
        return Object.keys(table).map(name => weightRow(labels[name], table, name));
    }

    function section(title, rows) {
        const block = element('div', 'sp-section sq-section');
        const toggle = element('button', 'sq-section-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', String(expanded.has(title)));
        toggle.append(element('span', 'sq-arrow', expanded.has(title) ? '▾' : '▸'), element('span', 'sp-section-title', title));
        const content = element('div', 'sq-section-body');
        content.hidden = !expanded.has(title);
        content.append(...rows);
        toggle.addEventListener('click', () => {
            const open = content.hidden;
            content.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            toggle.firstChild.textContent = open ? '▾' : '▸';
            if (open) expanded.add(title); else expanded.delete(title);
        });
        block.append(toggle, content);
        return block;
    }

    function selectRow(label, options, current, onChange) {
        const row = element('div', 'sp-row sq-select-row');
        const name = element('label', 'sp-label', label);
        const select = element('select');
        select.id = 'sq-' + Math.random().toString(36).slice(2);
        name.htmlFor = select.id;
        for (const [value, text] of options) {
            const option = element('option', '', text);
            option.value = value;
            select.appendChild(option);
        }
        select.value = String(current);
        select.addEventListener('change', () => onChange(select.value, select));
        row.append(name, select);
        return row;
    }

    // ── Ranges ────────────────────────────────
    // Natural notes from the hand's limits, as staff steps. Moving one end
    // closer than an octave to the other pushes the other end along.
    function rangeRows(handName, range, limits) {
        const steps = [];
        for (let step = limits.low; step <= limits.high; step++) steps.push([step, SequencePitch.label(SequencePitch.fromStep(step, 0))]);
        const gap = SequenceDifficulty.MIN_RANGE_STEPS;
        let lowSelect = null, highSelect = null;
        const lowRow = selectRow(handName + ' hand, lowest', steps, range.low, value => {
            range.low = Number(value);
            if (range.high - range.low < gap) range.high = Math.min(limits.high, range.low + gap);
            if (range.high - range.low < gap) range.low = range.high - gap;
            lowSelect.value = range.low; highSelect.value = range.high;
            changed();
        });
        const highRow = selectRow(handName + ' hand, highest', steps, range.high, value => {
            range.high = Number(value);
            if (range.high - range.low < gap) range.low = Math.max(limits.low, range.high - gap);
            if (range.high - range.low < gap) range.high = range.low + gap;
            lowSelect.value = range.low; highSelect.value = range.high;
            changed();
        });
        lowSelect = lowRow.querySelector('select');
        highSelect = highRow.querySelector('select');
        return [lowRow, highRow];
    }

    // ── Bindings ──────────────────────────────
    function bindingsTable() {
        const settings = hooks.settings();
        const table = element('div', 'sq-bindings');
        table.append(element('span', 'sq-bindings-head', 'Control'),
                     ...Object.values(LABELS.methods).map(text => element('span', 'sq-bindings-head', text)));
        for (const command of SequenceStore.COMMANDS) {
            table.appendChild(element('span', 'sp-label', LABELS.commands[command]));
            for (const method of Object.keys(LABELS.methods)) {
                const cell = element('span', 'sq-binding');
                const current = element('span', 'sq-binding-key', SequenceBindings.label(method, settings.bindings[method][command]));
                const change = element('button', 'sq-binding-button sq-change', 'Change');
                change.type = 'button';
                change.setAttribute('aria-label', 'Change the ' + LABELS.methods[method] + ' for ' + LABELS.commands[command]);
                change.addEventListener('click', () => {
                    table.querySelectorAll('.sq-change').forEach(button => { button.textContent = 'Change'; });
                    change.textContent = method === 'midi' ? 'Play a key…' : 'Press a key… (Esc cancels)';
                    SequenceBindings.learn(method, key => {
                        SequenceBindings.assign(settings.bindings[method], command, key);
                        rebuildBindings();
                        changed();
                    }, rebuildBindings);
                });
                const clear = element('button', 'sq-binding-button', '✕');
                clear.type = 'button';
                clear.setAttribute('aria-label', 'Remove the ' + LABELS.methods[method] + ' for ' + LABELS.commands[command]);
                clear.addEventListener('click', () => {
                    settings.bindings[method][command] = null;
                    rebuildBindings();
                    changed();
                });
                cell.append(current, change, clear);
                table.appendChild(cell);
            }
        }
        return table;
    }

    function rebuildBindings() {
        SequenceBindings.cancelLearning();
        body.querySelector('.sq-bindings').replaceWith(bindingsTable());
    }

    // ── The whole panel ───────────────────────
    function build() {
        const settings = hooks.settings();
        const parameters = settings.parameters;
        body.innerHTML = '';

        const presetOptions = Object.entries(SequenceDifficulty.PRESETS).map(([id, preset]) => [id, preset.name])
            .concat([['custom', 'Custom']]);
        const presetRow = selectRow('Preset', presetOptions, SequenceDifficulty.matchingPreset(parameters) || 'custom', value => {
            if (value === 'custom') return;
            settings.parameters = SequenceDifficulty.presetParameters(value);
            build();
            changed();
        });
        presetSelect = presetRow.querySelector('select');
        presetSelect.querySelector('option[value=custom]').disabled = true;
        body.appendChild(presetRow);

        const tempoRow = element('div', 'sp-row sq-plain-row');
        const tempoValue = element('span', 'sp-weight-val', settings.tempo);
        const tempoSlider = element('input', 'sp-slider');
        tempoSlider.type = 'range';
        tempoSlider.min = SequenceStore.TEMPO.lowest;
        tempoSlider.max = SequenceStore.TEMPO.highest;
        tempoSlider.value = settings.tempo;
        tempoSlider.setAttribute('aria-label', 'Playback tempo, quarter notes per minute');
        tempoSlider.addEventListener('input', () => {
            settings.tempo = Number(tempoSlider.value);
            tempoValue.textContent = tempoSlider.value;
            changed();
        });
        tempoRow.append(element('span', 'sp-label', 'Playback tempo (♩ per minute)'), tempoValue, tempoSlider);

        body.append(
            section('Passage', [
                selectRow('Time signature', Object.keys(SequenceMeter.TIME_SIGNATURES).map(name => [name, name]),
                          settings.timeSignature, value => { settings.timeSignature = value; changed(); }),
                tempoRow,
            ]),
            section('Keys', [
                ...weightRows(parameters.modes, LABELS.modes),
                ...parameters.signatures.map((weight, count) => weightRow(
                    count === 0 ? 'No sharps or flats' : count + (count === 1 ? ' sharp or flat' : ' sharps or flats'),
                    parameters.signatures, count)),
            ]),
            section('Progressions', SequenceProgressions.TEMPLATES.map(template =>
                weightRow(template.id + (template.mode === 'minor' ? '  (minor)' : ''), parameters.progressions[template.id], 'weight'))),
            section('Rhythm', weightRows(parameters.rhythm, LABELS.rhythm)),
            section('Melody intervals', weightRows(parameters.intervals, LABELS.intervals)),
            section('Weak-beat notes', weightRows(parameters.weakBeats, LABELS.weakBeats)),
            section('Left-hand patterns', SequenceDifficulty.PATTERN_IDS.map(id =>
                weightRow(LABELS.patterns[id], parameters.patterns[id], 'weight'))),
            section('Hand ranges', [
                ...rangeRows('Right', parameters.rightRange, SequenceDifficulty.RANGE_LIMITS.rightRange),
                ...rangeRows('Left', parameters.leftRange, SequenceDifficulty.RANGE_LIMITS.leftRange),
            ]),
            section('Controls', [bindingsTable()]),
        );
        showWarning();
    }

    // ── Opening and closing ───────────────────
    function open() {
        clearTimeout(closeTimer);
        build();
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('visible'));
        document.getElementById('spCloseBtn').focus();
    }

    function close() {
        SequenceBindings.cancelLearning();
        modal.classList.remove('visible');
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => { modal.style.display = 'none'; }, 250);
    }

    function isOpen() {
        return modal.style.display !== 'none';
    }

    // hooks: { settings(), boundMidi(), changed() }.
    function start(pageHooks) {
        hooks = pageHooks;
        document.getElementById('settingsBtn').addEventListener('click', open);
        document.getElementById('spCloseBtn').addEventListener('click', close);
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        // An Escape the bindings already used to cancel learning a key does
        // not also close the panel.
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && isOpen() && !event.defaultPrevented) close();
        });
    }

    return { start, isOpen };
})();
