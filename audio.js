// ═══════════════════════════════════════════════
//  WEB AUDIO — shared by every page
// ═══════════════════════════════════════════════

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// The app's one tone: a triangle with a sine overtone an octave up. The
// envelope starts at `start`; the main oscillator may begin `delay` later,
// which is how a chord rolls its notes. `length` is how long the voice lasts,
// release included.
function soundVoice(ctx, midi, start, length, delay) {
    const release = start + length - 0.1;
    // Short notes reach the sustain level sooner, so the envelope's points stay
    // in time order however short the note is.
    const sustainAt = start + Math.min(0.3, (length - 0.1) / 2);

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(midiToFreq(midi), start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.12, sustainAt);
    gain.gain.exponentialRampToValueAtTime(0.001, release);

    // Harmonic overtone
    const overtoneEnd = start + Math.min(1.5, length - 0.1);
    const osc2  = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(midiToFreq(midi) * 2, start);
    gain2.gain.setValueAtTime(0.06, start);
    gain2.gain.exponentialRampToValueAtTime(0.001, overtoneEnd);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(start);
    osc2.stop(overtoneEnd + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + delay);
    osc.stop(start + length);
}

function playChord(midiNotes) {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    midiNotes.forEach((midi, i) => soundVoice(ctx, midi, now, 2.6, i * 0.06));
}
