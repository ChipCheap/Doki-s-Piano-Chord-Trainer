// ═══════════════════════════════════════════════
//  SEQUENCE MODE — REVIEW VIEW (shell)
// ═══════════════════════════════════════════════

// After an attempt: one line of counts beneath the passage, the passage marked
// note by note, and in a panel of its own a grand staff of the passage notes
// that were played, in the order they were played. During an attempt, if the
// player asks for it, that panel alone fills in as each key goes down.
//
// The marks come from lining what was played up against the passage
// (SequenceComparison.compare): right, wrong note, out of order, missed, not
// reached. A checkbox switches to the simpler check that only counts which
// notes came up at all, in any order.
//
// The played staff shows only notes that match the passage, spelled as the
// passage spells them; keys the passage does not have are named in the
// summary, since a played key has no spelling of its own. Nothing names a hand
// or says anything about timing.
const SequenceReview = (() => {
    const element = SequenceDisplay.element;
    let anyOrder = false;
    let redraw = null;

    // The simpler check in the same shape as compare's result.
    function anyOrderResult(passage, played) {
        const check = SequenceComparison.wholePassage(passage, played);
        return {
            notes: check.notes.map(note => ({ ...note, status: note.cameUp ? 'matched' : 'missed' })),
            played: check.played.map(pair => ({ midi: pair.midi, pitch: pair.pitch, status: pair.pitch ? 'matched' : 'extra' })),
            octaveShift: 0,
        };
    }

    // How the review judges: the state owner's alignment, or the simpler count.
    function result(view) {
        return anyOrder ? anyOrderResult(view.passage, view.played) : view.outcome;
    }

    function count(items, status) {
        return items.filter(item => item.status === status).length;
    }

    function summary(outcome) {
        const notes = outcome.notes;
        const extra = outcome.played.filter(key => key.status === 'extra');
        const lines = [];
        if (count(notes, 'matched') === notes.length && extra.length === 0) {
            lines.push(element('p', 'review-head ok', '✓ Every note of the passage, and nothing else.'));
        } else {
            const parts = [count(notes, 'matched') + ' of ' + notes.length + ' right'];
            const mistakes = [['wrong', 'wrong note', 'wrong notes', '≠'], ['outOfOrder', 'out of order', 'out of order', '↔'],
                              ['missed', 'missed', 'missed', '✗'], ['notAttempted', 'not reached', 'not reached', '']];
            for (const [status, one, many, symbol] of mistakes) {
                const number = count(notes, status);
                if (number) parts.push(number + ' ' + (number === 1 ? one : many) + (symbol ? ' ' + symbol : ''));
            }
            // Where the unreached part begins, when the judging knows bars.
            const firstUnreached = notes.find(note => note.status === 'notAttempted');
            if (firstUnreached && Number.isInteger(firstUnreached.bar)) parts[parts.length - 1] += ' from bar ' + (firstUnreached.bar + 1);
            lines.push(element('p', 'review-head', parts.join(' · ')));
        }
        // Said even when everything else was right, since every note is only
        // right as judged after moving the attempt back.
        if (outcome.octaveShift) {
            const way = outcome.octaveShift > 0 ? 'higher' : 'lower';
            const size = Math.abs(outcome.octaveShift) === 1 ? 'an octave' : 'two octaves';
            lines.push(element('p', 'review-extra', 'Played ' + size + ' ' + way + ' than written; judged as if moved back.'));
        }
        if (extra.length) {
            lines.push(element('p', 'review-extra', 'Played but not in the passage: ' +
                extra.map(key => midiKeyLabel(key.midi) + (Number.isInteger(key.bar) ? ' in bar ' + (key.bar + 1) : '')).join(', ') + '.'));
        }
        return lines;
    }

    // The checkbox for the simpler check.
    function orderToggle() {
        const label = element('label', 'sequence-toggle review-order');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = anyOrder;
        checkbox.addEventListener('change', () => { anyOrder = checkbox.checked; redraw(); });
        label.append(checkbox, element('span', '', 'Count notes in any order'));
        return label;
    }

    // The matched keys in the order played, as columns of notes played
    // together: consecutive keys the judging placed in the same group of the
    // passage share a column. Without groups (the any-order count) every key
    // is a column of its own.
    function playedColumns(outcome) {
        const columns = [];
        let lastGroup = null;
        for (const key of outcome.played) {
            if (key.status !== 'matched' && key.status !== 'outOfOrder') continue;
            if (Number.isInteger(key.group) && key.group === lastGroup) {
                columns[columns.length - 1].push(key.pitch);
            } else {
                columns.push([key.pitch]);
            }
            lastGroup = key.group;
        }
        return columns;
    }

    // Fills `container` with the title and the staff of matched notes in the
    // order played, or a line saying where they will appear when nothing has
    // matched yet. After an octave shift the notes are drawn where they are
    // written, and the title says so.
    function playedStaff(container, passage, outcome) {
        container.innerHTML = '';
        const matched = playedColumns(outcome);
        const shift = outcome.octaveShift;
        const shown = shift ? ' — played ' + (Math.abs(shift) === 1 ? 'an octave' : 'two octaves') + ' ' +
                              (shift > 0 ? 'higher' : 'lower') + ' than shown' : '';
        container.appendChild(element('p', 'review-played-title', 'What you played, in order' + shown));
        if (matched.length === 0) {
            container.appendChild(element('p', 'review-played-empty', 'Notes of the passage you play appear here.'));
            return;
        }
        const staff = element('div', 'review-played');
        container.appendChild(staff);
        SequenceNotation.drawSequence(staff, passage.key, matched);
    }

    // pageHooks: { redraw() } — the page draws the review and the marked
    // passage again, for when the checkbox changes how the attempt is judged.
    function start(pageHooks) {
        redraw = pageHooks.redraw;
    }

    // Fills `container` with the review of the state owner's `view`, and
    // `playedContainer` with the played staff — hidden when no key matched —
    // and returns the marks for the passage's notation: each passage pitch →
    // its status. `playedContainer` is shown before it is drawn, so the staff
    // can be laid out for its width.
    function show(container, playedContainer, view) {
        const outcome = result(view);
        container.innerHTML = '';
        container.append(...summary(outcome), orderToggle());
        playedContainer.hidden = !outcome.played.some(key => key.pitch !== null);
        if (!playedContainer.hidden) playedStaff(playedContainer, view.passage, outcome);
        return new Map(outcome.notes.map(note => [note.pitch, note.status]));
    }

    // During an attempt: the played staff alone, so far, always from the full
    // alignment — the any-order count belongs to the review. The passage
    // itself is left unmarked until the attempt ends. `container` must be
    // showing.
    function showLive(container, view) {
        playedStaff(container, view.passage, view.outcome);
    }

    return { start, show, showLive };
})();
