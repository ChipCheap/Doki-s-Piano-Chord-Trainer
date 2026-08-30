// ═══════════════════════════════════════════════
//  PRACTICE SESSION
// ═══════════════════════════════════════════════

let practiceActive   = false;
let practiceAdvTimer = null;
const PRACTICE_ADVANCE_MS = 2000;

// Accumulates every note-on during an attempt so the snapshot
// is never empty even after the player releases all keys.
let practicePeakHeld = new Set();

// Each result is snapshotted when it is captured, never re-derived later: by
// the time it is rendered the live chord and held notes have already advanced.
const practiceResults = [];
let practiceFocusedId = null;
let practiceNextId = 1;

const practiceBtn         = document.getElementById('practiceBtn');
const practiceResultsCard = document.getElementById('practiceResults');
const practiceResultsList = document.getElementById('practiceResultsList');
const practiceFocusEmpty  = document.getElementById('practiceFocusEmpty');
const practiceFocusBody   = document.getElementById('practiceFocusBody');
const practiceFocusStaff  = document.getElementById('practiceFocusStaff');
const practiceFocusPiano  = document.getElementById('practiceFocusPiano');

// ── Session control ───────────────────────────
function startPracticeSession() {
    practiceActive = true;
    practiceBtn.textContent = '⏹ Stop Practice';
    practiceBtn.classList.add('active');
    practiceResultsCard.style.display = 'block';
    updatePracticeLayout();
}

function stopPracticeSession() {
    practiceActive = false;
    clearTimeout(practiceAdvTimer);
    practiceAdvTimer = null;
    practicePeakHeld.clear();
    practiceBtn.textContent = '▶ Start Practice';
    practiceBtn.classList.remove('active');
    midiPanic();
    // The panel stays up: stopping is usually followed by reviewing.
}

practiceBtn.addEventListener('click', () => {
    if (practiceActive) stopPracticeSession();
    else startPracticeSession();
});

function practiceResetAdvanceTimer() {
    if (!practiceActive) return;
    for (const n of midiHeldNotes) practicePeakHeld.add(n);
    clearTimeout(practiceAdvTimer);
    practiceAdvTimer = setTimeout(practiceCaptureAndAdvance, PRACTICE_ADVANCE_MS);
}

function practiceCaptureAndAdvance() {
    if (!practiceActive) return;

    addPracticeResult(
        [...currentChordNotes],
        new Set(practicePeakHeld),
        document.getElementById('chordName').textContent
    );

    practicePeakHeld.clear();
    midiPanic();
    randomizeChord();
}

// ── Results ───────────────────────────────────
function addPracticeResult(chordNotes, heldMidi, chordName) {
    const record = {
        id: practiceNextId++,
        chordNotes, heldMidi, chordName,
        correct: compareChord(chordNotes, heldMidi).correct
    };
    practiceResults.push(record);
    practiceResultsList.appendChild(buildPracticeThumb(record));
    focusPracticeResult(record.id, true);
}

function buildPracticeThumb(record) {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'practice-thumb';
    thumb.dataset.id = record.id;

    const head = document.createElement('div');
    head.className = 'practice-thumb-head';

    const name = document.createElement('span');
    name.className = 'practice-thumb-name';
    name.textContent = record.chordName;

    const badge = document.createElement('span');
    badge.className = 'practice-thumb-badge ' + (record.correct ? 'ok' : 'bad');
    badge.textContent = record.correct ? '✓' : '✗';

    head.appendChild(name);
    head.appendChild(badge);
    thumb.appendChild(head);

    const canvas = document.createElement('canvas');
    canvas.className = 'practice-thumb-canvas';
    canvas.width = 260; canvas.height = 64;
    thumb.appendChild(canvas);
    drawPiano(canvas, record.chordNotes, record.heldMidi, false, record.heldMidi);

    thumb.addEventListener('click', () => focusPracticeResult(record.id, false));
    return thumb;
}

function focusPracticeResult(id, autoScroll) {
    practiceFocusedId = id;
    for (const el of practiceResultsList.children) {
        el.classList.toggle('focused', Number(el.dataset.id) === id);
    }
    renderPracticeFocus(practiceResults.find(r => r.id === id));

    if (autoScroll) {
        const el = practiceResultsList.querySelector('[data-id="' + id + '"]');
        if (el) scrollThumbIntoView(el);
    }
}

function scrollThumbIntoView(el) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // block:'nearest' matters — without it, focusing a strip low on the page
    // scrolls the whole window and pulls the staff out of view.
    const opts = { inline: 'nearest', block: 'nearest' };
    el.scrollIntoView(reduced ? opts : { ...opts, behavior: 'smooth' });

    // Smooth scrolling is compositor-driven and stalls while the tab is hidden,
    // which would leave the newest result parked off screen. Snap it into place
    // if the animation never landed.
    setTimeout(() => {
        const strip = practiceResultsList.getBoundingClientRect();
        const thumb = el.getBoundingClientRect();
        if (thumb.left < strip.left - 1 || thumb.right > strip.right + 1) {
            el.scrollIntoView(opts);
        }
    }, 500);
}

function sizePracticeFocusCanvases() {
    const available = practiceFocusBody.clientWidth || 460;
    const w = Math.max(STAFF_MIN_WIDTH, Math.min(780, available));
    practiceFocusStaff.width = w; practiceFocusStaff.height = 480;
    practiceFocusPiano.width = w; practiceFocusPiano.height = 120;
}

function renderPracticeFocus(record) {
    if (!record) {
        practiceFocusBody.hidden = true;
        practiceFocusEmpty.hidden = false;
        return;
    }
    practiceFocusEmpty.hidden = true;
    practiceFocusBody.hidden = false;

    const { missing, extra } = compareChord(record.chordNotes, record.heldMidi);
    document.getElementById('practiceFocusName').textContent = record.chordName;

    const verdict = document.getElementById('practiceFocusVerdict');
    verdict.className = 'practice-focus-verdict ' + (record.correct ? 'ok' : 'bad');
    verdict.textContent = record.correct ? '✓ Correct' : '✗ ' + [
        missing.length ? 'missed ' + missing.map(n => noteLabel(n) + n.octave).join(', ') : '',
        extra.length   ? 'played ' + extra.map(midiNoteName).join(', ')                   : ''
    ].filter(Boolean).join(' · ');

    sizePracticeFocusCanvases();
    // The staff shows the target only — extra noteheads for the wrong notes
    // would be unreadable. The keyboard carries the verdict, with expandTo set
    // to the held notes so a mistake well outside the chord is still on screen.
    drawStaff(practiceFocusStaff, record.chordNotes);
    drawPiano(practiceFocusPiano, record.chordNotes, record.heldMidi, false, record.heldMidi);
}

document.getElementById('practiceClearBtn').addEventListener('click', () => {
    practiceResults.length = 0;
    practiceResultsList.innerHTML = '';
    practiceFocusedId = null;
    renderPracticeFocus(null);
});

// ── Layout ────────────────────────────────────
// Side-by-side needs all three: the panel is up, the user has not opted out,
// and there is width for both columns. Below the breakpoint the checkbox simply
// stops applying — no room means no choice to make.
const practiceWideQuery     = window.matchMedia('(min-width: 1280px)');
const appPanes              = document.getElementById('appPanes');
const practiceBelowCheckbox = document.getElementById('practiceBelowCheckbox');

function updatePracticeLayout() {
    const visible = practiceResultsCard.style.display !== 'none';
    const side = visible && !practiceBelowCheckbox.checked && practiceWideQuery.matches;
    const changed = appPanes.classList.contains('side-by-side') !== side;
    appPanes.classList.toggle('side-by-side', side);

    // The main card's width just changed, so the staff and keyboard have to be
    // redrawn at the new size.
    if (changed && typeof resizeCanvases === 'function') resizeCanvases();
    if (practiceFocusedId !== null) {
        renderPracticeFocus(practiceResults.find(r => r.id === practiceFocusedId));
    }
}

practiceWideQuery.addEventListener('change', updatePracticeLayout);
practiceBelowCheckbox.addEventListener('change', () => {
    writeStored('pianoChordResultsBelow', practiceBelowCheckbox.checked ? '1' : '0');
    updatePracticeLayout();
});
practiceBelowCheckbox.checked = readStored('pianoChordResultsBelow') === '1';
