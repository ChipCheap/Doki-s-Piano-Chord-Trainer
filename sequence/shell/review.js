// ═══════════════════════════════════════════════
//  SEQUENCE MODE — REVIEW VIEW (shell)
// ═══════════════════════════════════════════════

// Shows, after an attempt, which of the passage's notes came up at all, and
// which keys were played that the passage does not have. It never says which
// hand anything belongs to, and nothing about timing. Passage notes are named
// by their spelling; played keys, which have none, by both of their names.
const SequenceReview = (() => {
    const element = SequenceDisplay.element;

    // Fills `container` with the review of `played` against `passage`, and
    // returns the marks for the notation: each passage pitch → 'cameUp' or
    // 'missed'.
    function show(container, passage, played) {
        const check = SequenceComparison.wholePassage(passage, played);
        const missed = check.notes.filter(note => !note.cameUp);
        const cameUp = check.notes.length - missed.length;
        container.innerHTML = '';

        const verdict = missed.length === 0 && check.extra.length === 0;
        const head = element('p', 'review-head ' + (verdict ? 'ok' : 'bad'),
            (verdict ? '✓ ' : '') + cameUp + ' of ' + check.notes.length + ' notes came up' +
            (check.extra.length ? ', and ' + check.extra.length + ' played ' + (check.extra.length === 1 ? 'key was' : 'keys were') +
             ' not in the passage.' : '.'));
        container.appendChild(head);

        if (missed.length) {
            const byBar = new Map();
            for (const note of missed) {
                if (!byBar.has(note.bar)) byBar.set(note.bar, []);
                byBar.get(note.bar).push(SequencePitch.label(note.pitch));
            }
            const line = element('p', 'review-line');
            line.append(element('span', 'review-label', 'Not played'),
                        document.createTextNode([...byBar].map(([bar, labels]) => 'bar ' + (bar + 1) + ': ' + labels.join(', ')).join(' · ')));
            container.appendChild(line);
        }
        if (check.extra.length) {
            const line = element('p', 'review-line');
            line.append(element('span', 'review-label', 'Not in the passage'),
                        document.createTextNode(check.extra.map(midiKeyLabel).join(', ')));
            container.appendChild(line);
        }
        const legend = element('p', 'review-legend');
        legend.append(element('span', 'review-came', '●'), document.createTextNode(' came up   '),
                      element('span', 'review-missed', '✗'), document.createTextNode(' not played'));
        container.appendChild(legend);

        return new Map(check.notes.map(note => [note.pitch, note.cameUp ? 'cameUp' : 'missed']));
    }

    return { show };
})();
