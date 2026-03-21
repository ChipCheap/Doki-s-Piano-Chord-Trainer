// ═══════════════════════════════════════════════
//  UI INIT & APPLICATION BOOTSTRAP
// ═══════════════════════════════════════════════

const rootSelect      = document.getElementById('rootSelect');
const typeSelect      = document.getElementById('typeSelect');
const octaveSelect    = document.getElementById('octaveSelect');
const inversionSelect = document.getElementById('inversionSelect');
const playBtn         = document.getElementById('playBtn');
const randomBtn       = document.getElementById('randomBtn');
const staffCanvas     = document.getElementById('staffCanvas');
const pianoCanvas     = document.getElementById('pianoCanvas');
const paletteGrid     = document.getElementById('paletteGrid');

// Populate the inversion dropdown to match the current chord's note count
function repopulateInversionSelect(noteCount) {
    const current = parseInt(inversionSelect.value) || 0;
    inversionSelect.innerHTML = '';
    for (let i = 0; i < noteCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = INVERSION_NAMES[i] || `Inversion ${i}`;
        inversionSelect.appendChild(opt);
    }
    // Clamp selection to valid range
    inversionSelect.value = Math.min(current, noteCount - 1);
}

// Populate root dropdown
ALL_ROOT_NOTES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = name;
    rootSelect.appendChild(opt);
});

// Populate chord type dropdown
Object.keys(CHORD_TYPES).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    typeSelect.appendChild(opt);
});

// Populate quick-select palette
Object.keys(CHORD_TYPES).forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.textContent = t;
    btn.dataset.type = t;
    btn.onclick = () => { typeSelect.value = t; updateDisplay(); };
    paletteGrid.appendChild(btn);
});

// ── Shared state (read by midi.js and practice.js) ──
let currentChordNotes = [];
let currentOctave = 4;

function updateDisplay() {
    const rootIdx = parseInt(rootSelect.value);
    const type    = typeSelect.value;
    const octave  = parseInt(octaveSelect.value);
    const chordDef = CHORD_TYPES[type];

    const rootNoteName  = ALL_ROOT_NOTES[rootIdx];
    const rootNoteAugment = Array.from(rootNoteName)[1];
    const rootFullNote  = new Note(Array.from(rootNoteName)[0], octave, rootNoteAugment || '');

    // Repopulate inversion dropdown whenever note count may have changed
    repopulateInversionSelect(chordDef.semitones.length);
    const inversion = parseInt(inversionSelect.value) || 0;

    const rawNotes = determineNotes(rootFullNote, chordDef.intervals, chordDef.semitones);
    const notes    = applyInversion(rawNotes, inversion);
    currentChordNotes = notes;
    currentOctave = octave;
    midiCheckMatch();

    const invLabel = inversion > 0 ? ` (${INVERSION_NAMES[inversion]})` : '';
    document.getElementById('chordName').textContent      = `${rootNoteName} ${type}${invLabel}`;
    document.getElementById('chordNotesList').textContent = notes.map(n => n.name + n.augment).join(' · ');
    document.getElementById('infoIntervals').textContent  = chordDef.intervals;
    document.getElementById('infoFormula').textContent    = chordDef.formula;
    document.getElementById('infoQuality').textContent    = chordDef.quality;
    document.getElementById('infoNoteCount').textContent  = chordDef.semitones.length + ' notes';

    document.querySelectorAll('.palette-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });

    drawStaff(staffCanvas, notes);
    drawPiano(pianoCanvas, notes, octave, midiHeldNotes, document.getElementById('hideChordCheckbox').checked);
}

function resizeCanvases() {
    const cardW  = document.querySelector('.card').clientWidth - 56;
    const staffW = Math.max(400, Math.min(780, cardW));

    const pianoWrapper = document.querySelector('.piano-row .piano-wrapper');
    const pianoW = pianoWrapper ? Math.max(300, pianoWrapper.clientWidth) : staffW;

    staffCanvas.width  = staffW; staffCanvas.height = 400;
    pianoCanvas.width  = pianoW; pianoCanvas.height = 120;

    updateDisplay();
}

rootSelect.addEventListener('change', updateDisplay);
typeSelect.addEventListener('change', updateDisplay);
octaveSelect.addEventListener('change', updateDisplay);
inversionSelect.addEventListener('change', updateDisplay);
document.getElementById('hideChordCheckbox').addEventListener('change', redrawPiano);
randomBtn.addEventListener('click', () => randomizeChord());

playBtn.addEventListener('click', () => {
    const rootIdx = parseInt(rootSelect.value);
    const octave  = parseInt(octaveSelect.value);
    const chordDef = CHORD_TYPES[typeSelect.value];
    const rootNoteName = ALL_ROOT_NOTES[rootIdx];
    const rootNoteAugment = Array.from(rootNoteName)[1];
    const rootFullNote = new Note(Array.from(rootNoteName)[0], octave, rootNoteAugment || '');
    playChord(determineNotes(rootFullNote, chordDef.intervals, chordDef.semitones).map(n => n.midi));
    playBtn.textContent = '♩ Playing…';
    setTimeout(() => { playBtn.textContent = '▶ Play'; }, 2800);
});

// Collapsible: Chord Details & Quick Select
(function () {
    const toggle = document.getElementById('infoToggle');
    const body   = document.getElementById('infoBody');
    const arrow  = toggle.querySelector('.collapsible-arrow');
    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
        arrow.textContent = expanded ? '▸' : '▾';
    });
})();

window.addEventListener('resize', resizeCanvases);

// ── Service Worker & PWA install ──────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').style.display = 'flex';
});
document.getElementById('installBtn').addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            document.getElementById('installBanner').style.display = 'none';
        });
    }
});
document.getElementById('dismissBtn').addEventListener('click', () => {
    document.getElementById('installBanner').style.display = 'none';
});

// ── First render ──────────────────────────────
loadClefImages().then(() => resizeCanvases());
