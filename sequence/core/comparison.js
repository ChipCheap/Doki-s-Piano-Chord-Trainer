// ═══════════════════════════════════════════════
//  SEQUENCE MODE — COMPARING WHAT WAS PLAYED (core: pure, no page access)
// ═══════════════════════════════════════════════

// What was played is a flat list of MIDI numbers in the order the keys went
// down — no times, no hands. The passage's spellings are turned into MIDI
// numbers to compare against it; a played key is never given a spelling.
const SequenceComparison = (() => {
    // Which of the passage's notes came up at all, ignoring order. Counts
    // matter: a pitch written three times and played once came up once, and
    // the earliest written instances are the ones counted as played.
    //
    // Returns { notes, extra }: every passage note in written order as
    // { bar, position, pitch, cameUp }, and the played keys the passage does
    // not account for, as MIDI numbers in the order played.
    function wholePassage(passage, played) {
        const remaining = new Map();
        for (const midi of played) remaining.set(midi, (remaining.get(midi) || 0) + 1);

        const notes = [];
        for (const group of SequencePassage.groups(passage)) {
            for (const pitch of group.pitches) {
                const midi = SequencePitch.midi(pitch);
                const cameUp = (remaining.get(midi) || 0) > 0;
                if (cameUp) remaining.set(midi, remaining.get(midi) - 1);
                notes.push({ bar: group.bar, position: group.position, pitch, cameUp });
            }
        }

        const extra = [];
        for (let i = played.length - 1; i >= 0; i--) {
            const midi = played[i];
            if ((remaining.get(midi) || 0) > 0) {
                extra.unshift(midi);
                remaining.set(midi, remaining.get(midi) - 1);
            }
        }
        return { notes, extra };
    }

    return { wholePassage };
})();
