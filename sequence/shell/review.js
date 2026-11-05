// ═══════════════════════════════════════════════
//  SEQUENCE MODE — REVIEW VIEW (shell)
// ═══════════════════════════════════════════════

// After an attempt: one line of counts, the passage above marked note by note,
// and a grand staff of the passage notes that were played, in the order they
// were played. During an attempt, if the player asks for it, that staff alone
// fills in as each key goes down.
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

    function result(passage, played) {
        return anyOrder ? anyOrderResult(passage, played) : SequenceComparison.compare(passage, played);
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
            lines.push(element('p', 'review-extra', extra.length + (extra.length === 1 ? ' key' : ' keys') +
                ' played that the passage does not have there: ' + extra.map(key => midiKeyLabel(key.midi)).join(', ') + '.'));
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

    // The title and the staff of matched notes in the order played, or a
    // line saying where they will appear when nothing has matched yet.
    function playedStaff(container, passage, outcome) {
        const matched = outcome.played.filter(key => key.status === 'matched' || key.status === 'outOfOrder').map(key => key.pitch);
        container.appendChild(element('p', 'review-played-title', 'What you played, in order'));
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

    // Fills `container` with the review of `played` against `passage`, and
    // returns the marks for the passage's notation: each passage pitch → its
    // status. `container` must be showing, so the played staff can be laid
    // out for its width.
    function show(container, passage, played) {
        const outcome = result(passage, played);
        container.innerHTML = '';
        container.append(...summary(outcome), orderToggle());
        if (outcome.played.some(key => key.pitch !== null)) playedStaff(container, passage, outcome);
        return new Map(outcome.notes.map(note => [note.pitch, note.status]));
    }

    // During an attempt: the played staff alone, so far. The passage itself
    // is left unmarked until the attempt ends.
    function showLive(container, passage, played) {
        container.innerHTML = '';
        playedStaff(container, passage, result(passage, played));
    }

    return { start, show, showLive };
})();
