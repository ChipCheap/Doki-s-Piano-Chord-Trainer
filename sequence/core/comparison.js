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


    // ── Alignment ─────────────────────────────
    // Lines the played keys up against the passage the way a text diff lines
    // up two files, so that each key gets a place in the passage without any
    // timing: the passage as its groups of notes that start together, what
    // was played as the flat list of keys. Within a group any order matches.
    // A key close to a written note it stands in place of counts as a wrong
    // note instead of it; any other key is extra; a written note no key
    // accounts for is missed. A dropped or garbled MIDI note therefore costs
    // only itself. Groups after the furthest one reached cost nothing: they
    // were not attempted, not missed.
    //
    // The search is small dynamic programming over (played key, group, which
    // notes of that group are taken), choosing the fewest mistakes. On a tie it
    // prefers a match, then a wrong note, then closing the group, then an
    // extra key, and it gives up early only when that is strictly cheaper, so
    // the result never depends on chance.
    const NEAR_MISS = 2;
    // A wrong note costs less than a miss and an extra key together, so one key
    // in a note's place reads as a slip on that note — but more than either
    // alone, so a note simply played a group late reads as one note out of
    // order rather than as two wrong notes.
    const WRONG_COST = 1.5;
    // Room in the search's memo key for which notes of a group are taken: up
    // to five notes a group; the generator writes at most four (a triad and a
    // melody note).
    const MASK_SPACE = 32;

    // How far the attempt got, before any judging: a marker traced along the
    // passage, each key moving it to the next written note of the same pitch
    // no further than the end of the bar after the marker's — far enough for
    // a hand with a long note or a rest, near enough that a stray or garbled
    // key matching nothing close by leaves it where it is. Returns the
    // furthest group the marker reached, or −1 if none.
    function reach(groups, played) {
        const taken = new Set();
        let marker = 0, furthest = -1;
        for (const midi of played) {
            const lastBar = groups[marker].bar + 1;
            for (let groupIndex = marker; groupIndex < groups.length && groups[groupIndex].bar <= lastBar; groupIndex++) {
                const index = groups[groupIndex].notes.findIndex((note, noteIndex) =>
                    note.midi === midi && !taken.has(groupIndex * MASK_SPACE + noteIndex));
                if (index < 0) continue;
                taken.add(groupIndex * MASK_SPACE + index);
                marker = groupIndex;
                furthest = Math.max(furthest, groupIndex);
                break;
            }
        }
        return furthest;
    }

    function align(passage, played) {
        const groups = SequencePassage.groups(passage).map(group => ({
            bar: group.bar,
            notes: group.pitches.map(pitch => ({ pitch, midi: SequencePitch.midi(pitch) })),
        }));
        const memo = new Map();
        // The judging may not give up before the furthest group reached, so
        // notes left out up to there — a whole hand, say — show as missed
        // rather than as not reached.
        const reached = reach(groups, played);

        function unmatchedCount(group, mask) {
            return group.notes.filter((note, index) => !(mask & (1 << index))).length;
        }

        function best(playedIndex, groupIndex, mask) {
            const memoKey = (playedIndex * (groups.length + 1) + groupIndex) * MASK_SPACE + mask;
            if (memo.has(memoKey)) return memo.get(memoKey);
            const group = groups[groupIndex];
            const remaining = played.length - playedIndex;
            let result = { cost: Infinity, move: null };
            const consider = (cost, move) => { if (cost < result.cost) result = { cost, move }; };

            if (group && remaining > 0) {
                const midi = played[playedIndex];
                group.notes.forEach((note, index) => {
                    if (!(mask & (1 << index)) && note.midi === midi) {
                        consider(best(playedIndex + 1, groupIndex, mask | (1 << index)).cost, { kind: 'match', note: index });
                    }
                });
                group.notes.forEach((note, index) => {
                    if (mask & (1 << index) || note.midi === midi || Math.abs(note.midi - midi) > NEAR_MISS) return;
                    consider(WRONG_COST + best(playedIndex + 1, groupIndex, mask | (1 << index)).cost, { kind: 'wrong', note: index });
                });
            }
            if (group) consider(unmatchedCount(group, mask) + best(playedIndex, groupIndex + 1, 0).cost, { kind: 'close' });
            if (remaining > 0) consider(1 + best(playedIndex + 1, groupIndex, mask).cost, { kind: 'extra' });
            // Giving up here, considered last so it wins only when strictly
            // cheaper, and only once past the furthest group reached: every
            // key left is extra, the group in hand is missed where it was
            // begun, and the groups after it were not attempted.
            if (groupIndex > reached || (groupIndex === reached && mask !== 0)) {
                consider(remaining + (group && mask ? unmatchedCount(group, mask) : 0), { kind: 'stop' });
            }
            memo.set(memoKey, result);
            return result;
        }

        // Walk the best path once, recording what became of every note and key.
        const notes = groups.map(group => group.notes.map(note => ({ bar: group.bar, pitch: note.pitch, status: 'notAttempted' })));
        const keys = played.map(midi => ({ midi, status: 'extra', pitch: null, bar: 0 }));
        const keyGroups = [];
        let playedIndex = 0, groupIndex = 0, mask = 0;
        const closeGroup = () => notes[groupIndex].forEach(note => { if (note.status === 'notAttempted') note.status = 'missed'; });
        for (;;) {
            const { move } = best(playedIndex, groupIndex, mask);
            const nearestGroup = Math.min(groupIndex, groups.length - 1);
            const bar = groups[nearestGroup].bar;
            if (move.kind === 'stop') {
                if (groupIndex < groups.length && mask) closeGroup();
                for (; playedIndex < played.length; playedIndex++) {
                    keys[playedIndex].bar = bar;
                    keyGroups[playedIndex] = nearestGroup;
                }
                break;
            }
            if (move.kind === 'close') {
                closeGroup();
                groupIndex++;
                mask = 0;
                continue;
            }
            const key = keys[playedIndex];
            key.bar = bar;
            keyGroups[playedIndex] = nearestGroup;
            if (move.kind !== 'extra') {
                const note = notes[groupIndex][move.note];
                note.status = move.kind === 'match' ? 'matched' : 'wrong';
                key.status = move.kind === 'match' ? 'matched' : 'wrong';
                key.pitch = note.pitch;
                mask |= 1 << move.note;
            }
            playedIndex++;
        }

        // A missed note and an extra key of the same pitch close by — within
        // one group either side — are one note played out of order.
        notes.forEach((groupNotes, at) => groupNotes.forEach(note => {
            if (note.status !== 'missed') return;
            const midi = SequencePitch.midi(note.pitch);
            const partner = keys.findIndex((key, index) => key.status === 'extra' && key.midi === midi && Math.abs(keyGroups[index] - at) <= 1);
            if (partner < 0) return;
            note.status = 'outOfOrder';
            keys[partner].status = 'outOfOrder';
            keys[partner].pitch = note.pitch;
        }));

        // Complete only when every note of the last group was played right: a
        // neighbouring key brushed in the final chord must not end the attempt
        // before the right one goes down.
        const finalGroup = notes[notes.length - 1];
        return {
            notes: notes.flat(),
            played: keys,
            complete: finalGroup.every(note => note.status === 'matched'),
        };
    }

    // ── Octave displacement ───────────────────
    // The whole attempt aligned as played and shifted by one or two octaves
    // either way. A shift is reported when it explains at least half the
    // attempted notes and clearly more than playing it as written does — one
    // and a half times as many matches; everything is then judged as shifted.
    // octaveShift says how the attempt was played: +1 an octave higher than
    // written, −1 an octave lower, 0 as written.
    const OCTAVE_SHIFTS = [-2, -1, 1, 2];
    const SHIFT_SHARE = 0.5;
    const SHIFT_GAIN = 1.5;

    function compare(passage, played) {
        const matchedCount = result => result.notes.filter(note => note.status === 'matched').length;
        const plain = align(passage, played);
        let shifted = null, octaves = 0;
        for (const shift of OCTAVE_SHIFTS) {
            const candidate = align(passage, played.map(midi => midi + 12 * shift));
            if (!shifted || matchedCount(candidate) > matchedCount(shifted)) { shifted = candidate; octaves = shift; }
        }
        const attempted = shifted.notes.filter(note => note.status !== 'notAttempted').length;
        const displaced = matchedCount(shifted) >= attempted * SHIFT_SHARE && matchedCount(shifted) >= matchedCount(plain) * SHIFT_GAIN &&
                          matchedCount(shifted) > 0;
        if (!displaced) return { ...plain, octaveShift: 0 };
        shifted.played.forEach((key, index) => { key.midi = played[index]; });
        return { ...shifted, octaveShift: -octaves };
    }

    return { wholePassage, align, compare };
})();
