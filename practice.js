// ═══════════════════════════════════════════════
//  PRACTICE SESSION
// ═══════════════════════════════════════════════

let practiceActive   = false;
let practiceAdvTimer = null;
const PRACTICE_ADVANCE_MS = 2000;

// Accumulates every note-on during an attempt so the snapshot
// is never empty even after the player releases all keys.
let practicePeakHeld = new Set();

const practiceBtn = document.getElementById('practiceBtn');

function startPracticeSession() {
    practiceActive = true;
    practiceBtn.textContent = '⏹ Stop Practice';
    practiceBtn.classList.add('active');
    document.getElementById('practiceResults').style.display = 'block';
}

function stopPracticeSession() {
    practiceActive = false;
    clearTimeout(practiceAdvTimer);
    practiceAdvTimer = null;
    practicePeakHeld.clear();
    practiceBtn.textContent = '▶ Start Practice';
    practiceBtn.classList.remove('active');
    midiPanic();
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

    const snapshotHeld   = new Set(practicePeakHeld);
    const snapshotChord  = [...currentChordNotes];
    const snapshotName   = document.getElementById('chordName').textContent;
    const snapshotOctave = currentOctave;

    practicePeakHeld.clear();

    addPracticeResult(snapshotChord, snapshotHeld, snapshotName, snapshotOctave);
    midiPanic();
    randomizeChord();
}

function addPracticeResult(chordNotes, heldMidi, chordName, octave) {
    const container = document.getElementById('practiceResultsList');

    const thumb = document.createElement('div');
    thumb.className = 'practice-thumb';

    const nameEl = document.createElement('div');
    nameEl.className = 'practice-thumb-name';
    nameEl.textContent = chordName;
    thumb.appendChild(nameEl);

    const canvas = document.createElement('canvas');
    canvas.className = 'practice-thumb-canvas';
    canvas.height = 60;
    thumb.appendChild(canvas);

    container.appendChild(thumb);

    requestAnimationFrame(() => {
        canvas.width = canvas.clientWidth || 240;
        drawPiano(canvas, chordNotes, octave, heldMidi, false);
    });
}

document.getElementById('practiceClearBtn').addEventListener('click', () => {
    document.getElementById('practiceResultsList').innerHTML = '';
});
