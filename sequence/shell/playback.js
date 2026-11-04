// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PLAYBACK (shell)
// ═══════════════════════════════════════════════

// Plays a passage through the shared audio tone at the tempo setting. Only
// the state owner calls it, and only in review: hearing a passage before
// reading it would turn sight-reading into playing by ear.
const SequencePlayback = (() => {
    const LEAD_IN_SECONDS = 0.15;
    // Notes are released just before their full length, so repeated notes
    // are heard as separate notes.
    const ARTICULATION = 0.92;
    let stopCurrent = null;

    function play(passage, tempo) {
        stop();
        const eighthSeconds = 30 / tempo;
        const barLength = SequenceMeter.meter(passage.timeSignature).barLength;
        const notes = passage.bars.flatMap((bar, barIndex) => [...bar.right, ...bar.left].flatMap(event =>
            event.pitches.map(pitch => ({
                midi: SequencePitch.midi(pitch),
                start: LEAD_IN_SECONDS + (barIndex * barLength + event.position) * eighthSeconds,
                duration: event.duration * eighthSeconds * ARTICULATION,
            }))));
        stopCurrent = playNotes(notes);
    }

    // Pressing Play again restarts; leaving review stops whatever is sounding.
    function stop() {
        if (!stopCurrent) return;
        stopCurrent();
        stopCurrent = null;
    }

    return { play, stop };
})();
