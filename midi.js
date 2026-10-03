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

// ── Raw message log ───────────────────────────
// Off by default. Flaky cables and adapters corrupt individual bytes, and when
// a note-on arrives with a mangled note number its note-off never matches — the
// note is then stuck in the chord with nothing to remove it. That is invisible
// in the app's own display and only shows up in the raw stream.
const MIDI_DEBUG_MAX = 60;
let midiDebugOn = false;
let midiDebugTotal = 0;
let midiDebugOrphans = 0;
let midiDebugDirty = false;
const midiDebugLines = [];

function midiDebugRecord(data, text, suspect) {
    midiDebugTotal++;
    if (!midiDebugOn) return;
    const hex = [...data].map(b => b.toString(16).padStart(2, '0')).join(' ');
    // Explicit space after the pad so the longest message still separates from
    // the hex column instead of running into it.
    midiDebugLines.push((suspect ? '! ' : '  ') + text.padEnd(40) + ' ' + hex);
    if (midiDebugLines.length > MIDI_DEBUG_MAX) midiDebugLines.shift();
    // Aftertouch streams can arrive faster than the display needs updating, so
    // coalesce writes to one per frame.
    if (!midiDebugDirty) {
        midiDebugDirty = true;
        requestAnimationFrame(midiDebugRender);
    }
}

function midiDebugRender() {
    midiDebugDirty = false;
    if (!midiDebugOn) return;
    const log = document.getElementById('midiDebugLog');
    log.textContent = midiDebugLines.join('\n');
    log.scrollTop = log.scrollHeight;
    document.getElementById('midiDebugSummary').textContent =
        midiDebugTotal + ' messages · ' + midiDebugOrphans +
        ' unmatched note-off' + (midiDebugOrphans === 1 ? '' : 's');
}

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
    const data = event.data;
    const [status, note, velocity] = data;
    const type = status & 0xf0;
    const ch = (status & 0x0f) + 1;

    if (type === 0x90 && velocity > 0) {
        if (note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
            midiDebugRecord(data, 'ch' + ch + ' note-on ' + note + ' v' + velocity + ' — out of range', true);
            return;
        }
        midiDebugRecord(data, 'ch' + ch + ' note-on ' + note + ' v' + velocity, false);
        midiSustainPending.delete(note);
        midiHeldNotes.add(note);
        practiceResetAdvanceTimer();

    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        if (note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
            midiDebugRecord(data, 'ch' + ch + ' note-off ' + note + ' — out of range', true);
            return;
        }
        // A note-off for a note that was never on means its note-on was lost or
        // carried a corrupted note number. Counted whether or not the log is
        // showing, so switching Debug on reveals a history rather than nothing.
        const orphan = !midiHeldNotes.has(note) && !midiSustainPending.has(note);
        if (orphan) midiDebugOrphans++;
        midiDebugRecord(data, 'ch' + ch + ' note-off ' + note +
                        (orphan ? ' — no matching note-on' : ''), orphan);

        if (midiSustainHeld) midiSustainPending.add(note);
        else midiHeldNotes.delete(note);

    } else if (type === 0xa0) {
        // Polyphonic key pressure is only produced by a key that is physically
        // down, so it is evidence the note is still held. Without counting it,
        // the idle timeout fires mid-chord on a keyboard that streams
        // aftertouch. No display update: it changes nothing that is drawn.
        midiDebugRecord(data, 'ch' + ch + ' aftertouch ' + note + ' ' + velocity, false);
        midiResetIdleTimer();
        return;

    } else if (type === 0xb0) {
        midiDebugRecord(data, 'ch' + ch + ' CC ' + note + ' ' + velocity, false);
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
        // Deliberately does not reset the idle timeout: a pedal or knob says
        // nothing about which keys are down, and letting it hold the timeout
        // open would stop stuck notes from ever being cleared.
        return;

    } else {
        // Clock, active sensing and SysEx arrive constantly on some devices and
        // carry no information about held keys.
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

// ── Panel controls ────────────────────────────
document.getElementById('midiResetBtn').addEventListener('click', () => {
    midiPanic();
    // Also drop whatever the current practice attempt accumulated, or a stuck
    // note would still be counted against you when the attempt is captured.
    if (typeof practicePeakHeld !== 'undefined') practicePeakHeld.clear();
});

const midiDebugCheckbox = document.getElementById('midiDebugCheckbox');
const midiDebugPanel    = document.getElementById('midiDebug');

function midiApplyDebugVisibility() {
    midiDebugOn = midiDebugCheckbox.checked;
    midiDebugPanel.hidden = !midiDebugOn;
    midiDebugRender();
}

midiDebugCheckbox.addEventListener('change', () => {
    writeStored('pianoChordMidiDebug', midiDebugCheckbox.checked ? '1' : '0');
    midiApplyDebugVisibility();
});

document.getElementById('midiDebugClearBtn').addEventListener('click', () => {
    midiDebugLines.length = 0;
    midiDebugTotal = 0;
    midiDebugOrphans = 0;
    midiDebugRender();
});

midiDebugCheckbox.checked = readStored('pianoChordMidiDebug') === '1';
midiApplyDebugVisibility();

initMidi();
