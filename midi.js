// ═══════════════════════════════════════════════
//  MIDI INPUT & CHORD CHECKING
// ═══════════════════════════════════════════════

const midiHeldNotes    = new Set();
const midiSustainPending = new Set();
let midiSustainHeld    = false;

let midiIdleTimer = null;
const MIDI_IDLE_MS = 5000;

function midiResetIdleTimer() {
    clearTimeout(midiIdleTimer);
    midiIdleTimer = setTimeout(() => {
        if (midiHeldNotes.size > 0) midiPanic();
    }, MIDI_IDLE_MS);
}

const MIDI_NOTE_MIN = 21;  // A0
const MIDI_NOTE_MAX = 108; // C8

function initMidi() {
    if (!navigator.requestMIDIAccess) { midiSetStatus('unavailable'); return; }
    navigator.requestMIDIAccess().then(access => {
        attachMidiInputs(access);
        access.onstatechange = () => attachMidiInputs(access);
    }).catch(() => midiSetStatus('denied'));
}

function attachMidiInputs(access) {
    for (const input of access.inputs.values()) input.onmidimessage = null;
    const inputs = [...access.inputs.values()];
    if (inputs.length === 0) { midiSetStatus('no-device'); return; }
    midiSetStatus('connected');
    for (const input of inputs) input.onmidimessage = onMidiMessage;
    document.getElementById('midiDeviceName').textContent = inputs.map(i => i.name).join(', ');
}

function onMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const type = status & 0xf0;

    if (type === 0x90 && velocity > 0) {
        if (note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) return;
        midiSustainPending.delete(note);
        midiHeldNotes.add(note);
        practiceResetAdvanceTimer();

    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        if (note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) return;
        if (midiSustainHeld) midiSustainPending.add(note);
        else midiHeldNotes.delete(note);

    } else if (type === 0xb0) {
        if (note === 64) {
            if (velocity >= 64) {
                midiSustainHeld = true;
            } else {
                midiSustainHeld = false;
                for (const n of midiSustainPending) midiHeldNotes.delete(n);
                midiSustainPending.clear();
            }
        } else if (note === 120 || note === 123) {
            midiPanic();
        }
        return;

    } else {
        return;
    }

    midiResetIdleTimer();
    midiUpdateHeldDisplay();
    midiCheckMatch();
}

function midiPanic() {
    midiHeldNotes.clear();
    midiSustainPending.clear();
    midiSustainHeld = false;
    midiUpdateHeldDisplay();
    midiCheckMatch();
}

// The single definition of "did they play it right", shared by the live
// readout and the practice results so the two cannot disagree.
function compareChord(chordNotes, heldMidi) {
    const chordMidis = new Set(chordNotes.map(n => n.midi));
    const missing = chordNotes.filter(n => !heldMidi.has(n.midi));
    const extra   = [...heldMidi].filter(m => !chordMidis.has(m));
    return {missing, extra, correct: missing.length === 0 && extra.length === 0};
}

// Name for a bare MIDI number, where no spelling is known.
function midiNoteName(midi) {
    return NOTE_NAMES_FLAT[midi % 12] + (Math.floor(midi / 12) - 1);
}

function midiCheckMatch() {
    const resultEl = document.getElementById('midiResult');
    if (midiHeldNotes.size === 0) {
        resultEl.className = 'midi-result idle';
        resultEl.textContent = 'Play the chord…';
        return;
    }
    if (currentChordNotes.length === 0) return;

    const {missing, extra, correct} = compareChord(currentChordNotes, midiHeldNotes);

    if (correct) {
        resultEl.className = 'midi-result correct';
        resultEl.textContent = '✓ Correct!';
    } else if (missing.length === 0) {
        resultEl.className = 'midi-result extra';
        resultEl.textContent = '✓ All chord tones + ' + extra.map(midiNoteName).join(', ') + ' extra';
    } else {
        resultEl.className = 'midi-result wrong';
        resultEl.textContent = '✗ Missing: ' + missing.map(n => noteLabel(n) + n.octave).join(', ');
    }
}

function midiUpdateHeldDisplay() {
    const names = [...midiHeldNotes].sort((a, b) => a - b).map(n => {
        const pc  = n % 12;
        const oct = Math.floor(n / 12) - 1;
        return NOTE_NAMES_FLAT[pc] + (NOTE_NAMES_FLAT[pc].length > 1 ? '/' + NOTE_NAMES_SHARP[pc] : '') + oct;
    });
    document.getElementById('midiHeldNotes').textContent = names.length ? names.join('  ') : '—';
    redrawPiano();
}

function midiSetStatus(state) {
    const messages = { connected: 'Connected', 'no-device': 'No device found', denied: 'Permission denied', unavailable: 'Not supported in this browser' };
    document.getElementById('midiStatus').textContent = messages[state] || state;
    document.getElementById('midiStatusDot').className = 'midi-dot ' + state;
    if (state !== 'connected') document.getElementById('midiDeviceName').textContent = '';
}

function redrawPiano() {
    const hideChord = document.getElementById('hideChordCheckbox').checked;
    drawPiano(pianoCanvas, currentChordNotes, midiHeldNotes, hideChord);
}

initMidi();
