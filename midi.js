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

function midiCheckMatch() {
    const resultEl = document.getElementById('midiResult');
    if (midiHeldNotes.size === 0) {
        resultEl.className = 'midi-result idle';
        resultEl.textContent = 'Play the chord…';
        return;
    }
    if (currentChordNotes.length === 0) return;

    const chordMidis  = new Set(currentChordNotes.map(n => n.midi));
    const missingNotes = currentChordNotes.filter(n => !midiHeldNotes.has(n.midi));
    const extraMidi    = [...midiHeldNotes].filter(n => !chordMidis.has(n));
    const extraNames   = extraMidi.map(n => NOTE_NAMES_FLAT[n % 12] + (Math.floor(n / 12) - 1));

    if (missingNotes.length === 0 && extraNames.length === 0) {
        resultEl.className = 'midi-result correct';
        resultEl.textContent = '✓ Correct!';
    } else if (missingNotes.length === 0) {
        resultEl.className = 'midi-result extra';
        resultEl.textContent = '✓ All chord tones + ' + extraNames.join(', ') + ' extra';
    } else {
        resultEl.className = 'midi-result wrong';
        resultEl.textContent = '✗ Missing: ' + missingNotes.map(n => n.name + n.augment + n.octave).join(', ');
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
    drawPiano(pianoCanvas, currentChordNotes, currentOctave, midiHeldNotes, hideChord);
}

initMidi();
