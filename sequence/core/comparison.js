// ═══════════════════════════════════════════════
//  SEQUENCE MODE — COMPARING WHAT WAS PLAYED (core: pure, no page access)
// ═══════════════════════════════════════════════

// What was played is a flat list of MIDI numbers in the order the keys went
// down — no times, no hands. The passage's spellings are turned into MIDI
// numbers to compare against it; a played key is never given a spelling.
const SequenceComparison = (() => {
    // Which of the passage's notes came up at all, ignoring order. Counts
    // matter: a pitch written three times and played once came up once. Each
    // key is paired with the written notes of its pitch in turn — the first
    // time it was played with its first written instance, and so on — so the
    // earliest written instances are the ones counted as played, and the
    // latest plays beyond the written count are the extra ones.
    //
    // Returns { notes, played, extra }:
    //   notes  — every passage note in written order as { bar, position, pitch, cameUp }
    //   played — every played key in order as { midi, pitch }, pitch being the
    //            passage note it was paired with, or null if it is extra
    //   extra  — the MIDI numbers of the extra keys, in the order played
    function wholePassage(passage, played) {
        const written = new Map();
        const notes = [];
        for (const group of SequencePassage.groups(passage)) {
            for (const pitch of group.pitches) {
                const note = { bar: group.bar, position: group.position, pitch, cameUp: false };
                const midi = SequencePitch.midi(pitch);
                if (!written.has(midi)) written.set(midi, []);
                written.get(midi).push(note);
                notes.push(note);
            }
        }

        const pairedSoFar = new Map();
        const pairs = played.map(midi => {
            const index = pairedSoFar.get(midi) || 0;
            pairedSoFar.set(midi, index + 1);
            const note = (written.get(midi) || [])[index];
            if (!note) return { midi, pitch: null };
            note.cameUp = true;
            return { midi, pitch: note.pitch };
        });
        return { notes, played: pairs, extra: pairs.filter(pair => pair.pitch === null).map(pair => pair.midi) };
    }

    return { wholePassage };
})();
