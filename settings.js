// ═══════════════════════════════════════════════
//  RANDOMISATION SETTINGS & MODAL
// ═══════════════════════════════════════════════

const CHORD_GROUPS = [
    { name: 'Triads',     types: ['Major','Minor','Diminished','Augmented','Sus2','Sus4'],                                                                    maxNotes: 3 },
    { name: '7ths',       types: ['Major 7th','Minor 7th','Dominant 7th','Minor Major 7th','Half Dim 7th','Diminished 7th','Augmented 7th','Aug Maj 7th'],    maxNotes: 4 },
    { name: '9ths',       types: ['Add 9','Major 9th','Minor 9th','Dominant 9th'],                                                                            maxNotes: 5 },
    { name: '11ths',      types: ['Major 11th','Dominant 11th'],                                                                                              maxNotes: 6 },
    { name: '13ths',      types: ['Major 13th','Dominant 13th'],                                                                                              maxNotes: 7 },
    { name: 'Pentatonic', types: ['Power (5th)'],                                                                                                             maxNotes: 2 },
];

const OCTAVE_RANGE = [0, 1, 2, 3, 4, 5];

const randomSettings = {
    octaves: Object.fromEntries(OCTAVE_RANGE.map(o => [o, { enabled: true, weight: 100 }])),
    groups:  Object.fromEntries(CHORD_GROUPS.map(g => [g.name, {
        enabled: true, weight: 100, expanded: true,
        types: Object.fromEntries(g.types.map(t => [t, { enabled: true, weight: 100 }])),
        // One enabled flag per possible inversion (index 0 = root position)
        inversions: Array.from({ length: g.maxNotes }, () => true),
    }])),
};

// ── Persistence ───────────────────────────────
function saveSettingsToStorage() {
    localStorage.setItem('pianoChordSettings', JSON.stringify(randomSettings));
}

function loadSettingsFromStorage(data) {
    try {
        if (data.octaves) {
            for (const [k, v] of Object.entries(data.octaves)) {
                if (randomSettings.octaves[k]) Object.assign(randomSettings.octaves[k], v);
            }
        }
        if (data.groups) {
            for (const [gk, gv] of Object.entries(data.groups)) {
                if (!randomSettings.groups[gk]) continue;
                const { types, ...groupMeta } = gv;
                Object.assign(randomSettings.groups[gk], groupMeta);
                if (types) {
                    for (const [tk, tv] of Object.entries(types)) {
                        if (randomSettings.groups[gk].types[tk]) {
                            Object.assign(randomSettings.groups[gk].types[tk], tv);
                        }
                    }
                }
                if (gv.inversions && Array.isArray(gv.inversions)) {
                    gv.inversions.forEach((v, i) => {
                        if (i < randomSettings.groups[gk].inversions.length) {
                            randomSettings.groups[gk].inversions[i] = v;
                        }
                    });
                }
            }
        }
    } catch (e) { console.warn('Failed to apply settings:', e); }
}

// Restore on startup
(function () {
    const stored = localStorage.getItem('pianoChordSettings');
    if (stored) { try { loadSettingsFromStorage(JSON.parse(stored)); } catch (e) {} }
})();

// ── Weighted random selection ─────────────────
function weightedPick(candidates) {
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    if (total === 0) return null;
    let r = Math.random() * total;
    for (const c of candidates) { r -= c.weight; if (r <= 0) return c.item; }
    return candidates[candidates.length - 1].item;
}

function randomizeChord() {
    const octCandidates = OCTAVE_RANGE
        .filter(o => randomSettings.octaves[o].enabled && randomSettings.octaves[o].weight > 0)
        .map(o => ({ item: o, weight: randomSettings.octaves[o].weight }));
    const chosenOctave = weightedPick(octCandidates);
    if (chosenOctave === null) return false;

    const typeCandidates = [];
    for (const group of CHORD_GROUPS) {
        const gs = randomSettings.groups[group.name];
        if (!gs.enabled || gs.weight === 0) continue;
        for (const type of group.types) {
            const ts = gs.types[type];
            if (!ts.enabled || ts.weight === 0) continue;
            const effectiveWeight = (gs.weight * ts.weight) / 100;
            if (effectiveWeight > 0) typeCandidates.push({ item: type, weight: effectiveWeight });
        }
    }
    const chosenType = weightedPick(typeCandidates);
    if (chosenType === null) return false;

    rootSelect.value   = Math.floor(Math.random() * ALL_ROOT_NOTES.length);
    octaveSelect.value = chosenOctave;
    typeSelect.value   = chosenType;

    // Pick a random inversion from those enabled for this chord's group,
    // clamped to the actual note count of the chosen chord type.
    const chosenGroup = CHORD_GROUPS.find(g => g.types.includes(chosenType));
    if (chosenGroup) {
        const noteCount = CHORD_TYPES[chosenType].semitones.length;
        const gs = randomSettings.groups[chosenGroup.name];
        const invCandidates = gs.inversions
            .slice(0, noteCount) // can't exceed actual note count
            .map((enabled, i) => enabled ? i : null)
            .filter(i => i !== null);
        const chosenInv = invCandidates.length > 0
            ? invCandidates[Math.floor(Math.random() * invCandidates.length)]
            : 0;
        repopulateInversionSelect(noteCount);
        inversionSelect.value = chosenInv;
    }

    updateDisplay();
    return true;
}

// ── Settings modal ────────────────────────────
function openSettings() {
    buildSettingsModal();
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('visible');
    modal.addEventListener('transitionend', () => { modal.style.display = 'none'; }, { once: true });
}

document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
});

function buildSettingsModal() {
    // Fill octave rows
    const octContainer = document.getElementById('sp-octave-rows');
    octContainer.innerHTML = '';
    OCTAVE_RANGE.forEach(oct => {
        const s = randomSettings.octaves[oct];
        octContainer.appendChild(makeRow(
            `oct-${oct}`, `Octave ${oct}`, s.enabled, s.weight,
            enabled => { randomSettings.octaves[oct].enabled = enabled; },
            weight  => { randomSettings.octaves[oct].weight  = weight; }
        ));
    });

    // Fill chord group rows
    const chordContainer = document.getElementById('sp-chord-rows');
    chordContainer.innerHTML = '';
    CHORD_GROUPS.forEach(group => {
        const gs = randomSettings.groups[group.name];
        const groupBlock = document.createElement('div');
        groupBlock.className = 'sp-group';

        const toggle = document.createElement('button');
        toggle.className = 'sp-toggle';
        toggle.textContent = gs.expanded ? '▾' : '▸';
        toggle.title = 'Expand / collapse';

        const childrenEl = document.createElement('div');
        childrenEl.className = 'sp-group-children' + (gs.expanded ? '' : ' collapsed');
        toggle.addEventListener('click', () => {
            gs.expanded = !gs.expanded;
            toggle.textContent = gs.expanded ? '▾' : '▸';
            childrenEl.classList.toggle('collapsed', !gs.expanded);
        });

        const groupRow = makeRow(
            `group-${group.name}`, group.name, gs.enabled, gs.weight,
            enabled => { randomSettings.groups[group.name].enabled = enabled; },
            weight  => { randomSettings.groups[group.name].weight  = weight; }
        );
        groupRow.classList.add('sp-group-row');

        const groupHeader = document.createElement('div');
        groupHeader.className = 'sp-group-header';
        groupHeader.appendChild(toggle);
        groupHeader.appendChild(groupRow);
        groupBlock.appendChild(groupHeader);

        group.types.forEach(type => {
            const ts = gs.types[type];
            const typeRow = makeRow(
                `type-${type.replace(/[^a-z0-9]/gi, '-')}`, type, ts.enabled, ts.weight,
                enabled => { randomSettings.groups[group.name].types[type].enabled = enabled; },
                weight  => { randomSettings.groups[group.name].types[type].weight  = weight; }
            );
            typeRow.classList.add('sp-type-row');
            childrenEl.appendChild(typeRow);
        });

        // Inversion checkboxes for this group
        const invHeader = document.createElement('div');
        invHeader.className = 'sp-inv-header';
        invHeader.textContent = 'Inversions';
        childrenEl.appendChild(invHeader);

        const invRow = document.createElement('div');
        invRow.className = 'sp-inv-row';
        gs.inversions.forEach((enabled, i) => {
            const label = document.createElement('label');
            label.className = 'sp-inv-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = enabled;
            cb.addEventListener('change', () => {
                randomSettings.groups[group.name].inversions[i] = cb.checked;
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(INVERSION_NAMES[i] || `Inv ${i}`));
            invRow.appendChild(label);
        });
        childrenEl.appendChild(invRow);

        groupBlock.appendChild(childrenEl);
        chordContainer.appendChild(groupBlock);
    });

    // Wire footer buttons
    const saveBtn     = document.getElementById('spSaveBtn');
    const importLabel = document.getElementById('spImportLabel');
    const importInput = document.getElementById('spImportInput');
    const resetBtn    = document.getElementById('spResetBtn');
    const freshSave   = saveBtn.cloneNode(true);
    const freshReset  = resetBtn.cloneNode(true);
    saveBtn.replaceWith(freshSave);
    resetBtn.replaceWith(freshReset);

    freshSave.addEventListener('click', () => {
        saveSettingsToStorage();
        const blob = new Blob([JSON.stringify(randomSettings, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'settings.json'; a.click();
        URL.revokeObjectURL(url);
        freshSave.textContent = '✓ Saved!';
        setTimeout(() => { freshSave.textContent = '💾 Save Settings'; }, 1800);
    });

    importInput.value = '';
    importInput.onchange = () => {
        const file = importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                loadSettingsFromStorage(JSON.parse(e.target.result));
                saveSettingsToStorage();
                buildSettingsModal();
                importLabel.textContent = '✓ Imported!';
                setTimeout(() => { importLabel.textContent = '📂 Import JSON'; }, 1800);
            } catch {
                importLabel.textContent = '✗ Invalid file';
                setTimeout(() => { importLabel.textContent = '📂 Import JSON'; }, 1800);
            }
        };
        reader.readAsText(file);
    };

    freshReset.addEventListener('click', () => {
        OCTAVE_RANGE.forEach(o => { randomSettings.octaves[o] = { enabled: true, weight: 100 }; });
        CHORD_GROUPS.forEach(g => {
            randomSettings.groups[g.name].enabled = true;
            randomSettings.groups[g.name].weight  = 100;
            g.types.forEach(t => { randomSettings.groups[g.name].types[t] = { enabled: true, weight: 100 }; });
            randomSettings.groups[g.name].inversions = Array.from({ length: g.maxNotes }, () => true);
        });
        saveSettingsToStorage();
        buildSettingsModal();
    });
}

function makeRow(id, label, enabled, weight, onEnabled, onWeight) {
    const row = document.createElement('div');
    row.className = 'sp-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = 'cb-' + id; cb.checked = enabled; cb.className = 'sp-checkbox';
    cb.addEventListener('change', () => onEnabled(cb.checked));

    const lbl = document.createElement('label');
    lbl.htmlFor = 'cb-' + id; lbl.textContent = label; lbl.className = 'sp-label';

    const valDisplay = document.createElement('span');
    valDisplay.className = 'sp-weight-val';
    valDisplay.textContent = weight + '%';

    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = weight;
    slider.className = 'sp-slider';
    slider.addEventListener('input', () => {
        const v = parseInt(slider.value);
        onWeight(v);
        valDisplay.textContent = v + '%';
    });

    row.appendChild(cb); row.appendChild(lbl); row.appendChild(valDisplay); row.appendChild(slider);
    return row;
}

document.getElementById('settingsBtn').addEventListener('click', openSettings);
