// ═══════════════════════════════════════════════
//  SEQUENCE MODE — REVIEW VIEW (shell)
// ═══════════════════════════════════════════════

// After an attempt: one line saying how much of the passage came up, the
// passage above marked note by note, and a grand staff of the passage notes
// that were played, in the order they were played. The played staff shows
// only notes that match the passage, spelled as the passage spells them;
// keys the passage does not have are named in the summary line, since a
// played key has no spelling of its own. Nothing names a hand or says
// anything about timing.
const SequenceReview = (() => {
    const element = SequenceDisplay.element;

    function summary(check) {
        const total = check.notes.length;
        const cameUp = check.notes.filter(note => note.cameUp).length;
        const extra = check.extra.length;
        const lines = [];
        if (cameUp === total && extra === 0) {
            lines.push(element('p', 'review-head ok', '✓ Every note of the passage came up, and nothing else.'));
            return lines;
        }
        lines.push(element('p', 'review-head', cameUp + ' of ' + total + ' notes came up' +
            (cameUp < total ? '; the passage above marks the others ✗.' : '.')));
        if (extra) {
            lines.push(element('p', 'review-extra', extra + (extra === 1 ? ' key' : ' keys') +
                ' played that the passage does not have: ' + check.extra.map(midiKeyLabel).join(', ') + '.'));
        }
        return lines;
    }

    // Fills `container` with the review of `played` against `passage`, and
    // returns the marks for the passage's notation: each passage pitch →
    // 'cameUp' or 'missed'. `container` must be showing, so the played staff
    // can be laid out for its width.
    function show(container, passage, played) {
        const check = SequenceComparison.wholePassage(passage, played);
        container.innerHTML = '';
        container.append(...summary(check));

        const matched = check.played.filter(pair => pair.pitch !== null).map(pair => pair.pitch);
        if (matched.length) {
            container.appendChild(element('p', 'review-played-title', 'What you played, in order'));
            const staff = element('div', 'review-played');
            container.appendChild(staff);
            SequenceNotation.drawSequence(staff, passage.key, matched);
        }
        return new Map(check.notes.map(note => [note.pitch, note.cameUp ? 'cameUp' : 'missed']));
    }

    return { show };
})();
