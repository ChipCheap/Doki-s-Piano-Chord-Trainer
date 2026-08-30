// ═══════════════════════════════════════════════
//  RANDOMISATION SETTINGS & MODAL
// ═══════════════════════════════════════════════

const CHORD_GROUPS = [
    { name: 'Triads',     types: ['Major','Minor','Diminished','Augmented','Sus2','Sus4'] },
    { name: '7ths',       types: ['Major 7th','Minor 7th','Dominant 7th','Minor Major 7th','Half Dim 7th','Diminished 7th','Augmented 7th','Aug Maj 7th'] },
    { name: '9ths',       types: ['Add 9','Major 9th','Minor 9th','Dominant 9th'] },
    { name: '11ths',      types: ['Major 11th','Dominant 11th'] },
    { name: '13ths',      types: ['Major 13th','Dominant 13th'] },
    { name: 'Pentatonic', types: ['Power (5th)'] },
];

// Octave 0 is excluded: C0 is MIDI 12, below the lowest key of an 88-key
// piano (A0 = 21), and midi.js rejects anything under 21 — so an octave-0
// chord can never be played correctly, and its ledger lines run off the staff.
const OCTAVE_RANGE = [1, 2, 3, 4, 5];

// Longest inversion list any type in this group needs. Types that offer fewer
// (Add 9 among the 9ths) are clamped again when a chord is actually picked.
function groupInversionCount(group) {
    return Math.max(...group.types.map(t => inversionCount(CHORD_TYPES[t])));
}

const randomSettings = {
    octaves: Object.fromEntries(OCTAVE_RANGE.map(o => [o, { enabled: true, weight: 100 }])),
    groups:  Object.fromEntries(CHORD_GROUPS.map(g => [g.name, {
        enabled: true, weight: 100, expanded: true,
        types: Object.fromEntries(g.types.map(t => [t, { enabled: true, weight: 100 }])),
        // One enabled flag per possible inversion (index 0 = root position)
        inversions: Array.from({ length: groupInversionCount(g) }, () => true),
    }])),
};

// ── Persistence ───────────────────────────────
// Every localStorage touch goes through these. Where storage is blocked (some
// file:// contexts, strict privacy modes) the raw calls throw, and an
// unguarded throw at load time would abort the rest of this file — taking the
// settings button's listener at the bottom with it.
function readStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStored(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}

function saveSettingsToStorage() {
    return writeStored('pianoChordSettings', JSON.stringify(randomSettings));
}

// Settings persist as you change them. Requiring an explicit Save was losing
// every adjustment made by anyone who closed the modal without pressing it.
let autoSaveTimer = null;
function settingsChanged() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveSettingsToStorage, 300);
    refreshEmptyWarnings();
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
                // inversions is destructured out alongside types: leaving it
                // in groupMeta let Object.assign replace the array wholesale,
                // which silently defeated the length guard below.
                const { types, inversions, ...groupMeta } = gv;
                Object.assign(randomSettings.groups[gk], groupMeta);
                if (types) {
                    for (const [tk, tv] of Object.entries(types)) {
                        if (randomSettings.groups[gk].types[tk]) {
                            Object.assign(randomSettings.groups[gk].types[tk], tv);
                        }
                    }
                }
                if (Array.isArray(inversions)) {
                    inversions.forEach((v, i) => {
                        if (i < randomSettings.groups[gk].inversions.length) {
                            randomSettings.groups[gk].inversions[i] = !!v;
                        }
                    });
                }
            }
        }
    } catch (e) { console.warn('Failed to apply settings:', e); }
}

// Restore on startup
(function () {
    const stored = readStored('pianoChordSettings');
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

function octaveCandidates() {
    return OCTAVE_RANGE
        .filter(o => randomSettings.octaves[o].enabled && randomSettings.octaves[o].weight > 0)
        .map(o => ({ item: o, weight: randomSettings.octaves[o].weight }));
}

function typeCandidates() {
    const out = [];
    for (const group of CHORD_GROUPS) {
        const gs = randomSettings.groups[group.name];
        if (!gs.enabled || gs.weight === 0) continue;
        for (const type of group.types) {
            const ts = gs.types[type];
            if (!ts.enabled || ts.weight === 0) continue;
            const effectiveWeight = (gs.weight * ts.weight) / 100;
            if (effectiveWeight > 0) out.push({ item: type, weight: effectiveWeight });
        }
    }
    return out;
}

function hasRandomCandidates() {
    return octaveCandidates().length > 0 && typeCandidates().length > 0;
}

// Randomising silently did nothing when everything was switched off. Say so,
// in both places the user could be looking, and only in that state.
function refreshEmptyWarnings() {
    const empty = !hasRandomCandidates();
    const main  = document.getElementById('randomWarning');
    const panel = document.getElementById('spEmptyWarning');
    if (main)  main.hidden  = !empty;
    if (panel) panel.hidden = !empty;
}

function randomizeChord() {
    const chosenOctave = weightedPick(octaveCandidates());
    if (chosenOctave === null) { refreshEmptyWarnings(); return false; }

    const chosenType = weightedPick(typeCandidates());
    if (chosenType === null) { refreshEmptyWarnings(); return false; }

    rootSelect.value   = Math.floor(Math.random() * ALL_ROOT_NOTES.length);
    octaveSelect.value = chosenOctave;
    typeSelect.value   = chosenType;

    // Pick a random inversion from those enabled for this chord's group,
    // clamped to the actual note count of the chosen chord type.
    const chosenGroup = CHORD_GROUPS.find(g => g.types.includes(chosenType));
    if (chosenGroup) {
        const invCount = inversionCount(CHORD_TYPES[chosenType]);
        const gs = randomSettings.groups[chosenGroup.name];
        const invCandidates = gs.inversions
            .slice(0, invCount) // this type may offer fewer than the group does
            .map((enabled, i) => enabled ? i : null)
            .filter(i => i !== null);
        const chosenInv = invCandidates.length > 0
            ? invCandidates[Math.floor(Math.random() * invCandidates.length)]
            : 0;
        repopulateInversionSelect(invCount);
        inversionSelect.value = chosenInv;
    }

    updateDisplay();
    return true;
}

// ── Settings modal ────────────────────────────
// Hiding the modal has to wait for the fade, which leaves a pending handler
// that must be cancellable — otherwise reopening mid-fade lets the old close
// finish and hide the modal that just reopened.
let closeTimer = null;
let closeHandler = null;

function cancelPendingClose() {
    const modal = document.getElementById('settingsModal');
    clearTimeout(closeTimer);
    if (closeHandler) modal.removeEventListener('transitionend', closeHandler);
    closeTimer = null;
    closeHandler = null;
}

function openSettings() {
    buildSettingsModal();
    const modal = document.getElementById('settingsModal');
    cancelPendingClose();
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('visible');
    cancelPendingClose();
    // The timer is a fallback for when no transition runs at all (reduced
    // motion, or the modal was already faded). The target check keeps a
    // transitionend bubbling up from a child button from closing the panel.
    closeHandler = e => {
        if (e && e.target !== modal) return;
        cancelPendingClose();
        modal.style.display = 'none';
    };
    modal.addEventListener('transitionend', closeHandler);
    closeTimer = setTimeout(closeHandler, 300);
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
            settingsChanged();
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
                settingsChanged();
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(INVERSION_NAMES[i] || `Inv ${i}`));
            invRow.appendChild(label);
        });
        childrenEl.appendChild(invRow);

        groupBlock.appendChild(childrenEl);
        chordContainer.appendChild(groupBlock);
    });

    // Wire footer buttons. Save and Export were one button that always did
    // both; downloading a file on every save was surprising, and with
    // auto-save in place the two have nothing to do with each other.
    const importText  = document.getElementById('spImportText');
    const importInput = document.getElementById('spImportInput');
    const flash = (el, msg, restore) => {
        if (!el) return;
        el.textContent = msg;
        setTimeout(() => { el.textContent = restore; }, 1800);
    };

    // Cloned to drop listeners from a previous build of the modal.
    const replaceBtn = id => {
        const old = document.getElementById(id);
        if (!old) return null;
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
        return fresh;
    };
    const freshSave   = replaceBtn('spSaveBtn');
    const freshExport = replaceBtn('spExportBtn');
    const freshReset  = replaceBtn('spResetBtn');

    if (freshSave) freshSave.addEventListener('click', () => {
        const ok = saveSettingsToStorage();
        flash(freshSave, ok ? '✓ Saved!' : '✗ Storage blocked', '💾 Save');
    });

    if (freshExport) freshExport.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(randomSettings, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'doki-chord-settings.json'; a.click();
        URL.revokeObjectURL(url);
        flash(freshExport, '✓ Exported!', '⬇ Export File');
    });

    if (importInput) {
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
                    flash(document.getElementById('spImportText'), '✓ Imported!', '📂 Import JSON');
                } catch {
                    flash(importText, '✗ Invalid file', '📂 Import JSON');
                }
            };
            reader.readAsText(file);
        };
    }

    if (freshReset) freshReset.addEventListener('click', () => {
        OCTAVE_RANGE.forEach(o => { randomSettings.octaves[o] = { enabled: true, weight: 100 }; });
        CHORD_GROUPS.forEach(g => {
            randomSettings.groups[g.name].enabled = true;
            randomSettings.groups[g.name].weight  = 100;
            g.types.forEach(t => { randomSettings.groups[g.name].types[t] = { enabled: true, weight: 100 }; });
            randomSettings.groups[g.name].inversions = Array.from({ length: groupInversionCount(g) }, () => true);
        });
        saveSettingsToStorage();
        buildSettingsModal();
    });

    refreshEmptyWarnings();
}

function makeRow(id, label, enabled, weight, onEnabled, onWeight) {
    const row = document.createElement('div');
    row.className = 'sp-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = 'cb-' + id; cb.checked = enabled; cb.className = 'sp-checkbox';
    cb.addEventListener('change', () => { onEnabled(cb.checked); settingsChanged(); });

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
        settingsChanged();
    });

    row.appendChild(cb); row.appendChild(lbl); row.appendChild(valDisplay); row.appendChild(slider);
    return row;
}

document.getElementById('settingsBtn').addEventListener('click', openSettings);

// Reflect the stored state on first load, before the modal is ever opened.
refreshEmptyWarnings();
