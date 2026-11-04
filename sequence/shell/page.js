// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PAGE BOOTSTRAP (shell)
// ═══════════════════════════════════════════════

// Loaded last: wires the page to the store, the state owner, playback, the
// bindings and the settings panel, and draws everything from the state
// owner's view. It exposes nothing; every part it needs is already loaded.
(() => {
    const controls = {
        generate: document.getElementById('generateBtn'),
        done: document.getElementById('doneBtn'),
        retry: document.getElementById('retryBtn'),
        play: document.getElementById('playBtn'),
    };
    const status = document.getElementById('sequenceStatus');
    const notation = document.getElementById('notation');
    const notationEmpty = document.getElementById('notationEmpty');
    const review = document.getElementById('review');

    const settings = SequenceStore.loadSettings();
    const boundMidi = () => new Set(Object.values(settings.bindings.midi).filter(key => key !== null));

    const HINTS = {
        shown: 'Read it through, then start playing: the first note starts the attempt.',
        attempt: count => 'Playing — ' + count + ' note' + (count === 1 ? '' : 's') + ' so far. Press Done when you have finished.',
        review: 'Retry the same passage, or generate a new one.',
    };

    const describe = problem => problem.message + (problem.keys.length ? ' ' + problem.keys.map(midiKeyLabel).join(', ') : '');

    // A failure first, then settings that cannot produce a passage, then a
    // passage that uses a key since bound to a control; otherwise a hint.
    function statusMessage(view) {
        if (view.problem) return { problem: true, text: describe(view.problem) };
        const settingsProblem = SequenceGenerator.problems(settings, boundMidi());
        if (settingsProblem) return { problem: true, text: 'Settings: ' + describe(settingsProblem) };
        if (view.passage && (view.state === 'shown' || view.state === 'attempt')) {
            const bound = boundMidi();
            const clashes = new Set(SequencePassage.groups(view.passage).flatMap(group =>
                group.pitches.map(SequencePitch.midi)).filter(midi => bound.has(midi)));
            if (clashes.size) {
                return { problem: true, text: 'This passage uses ' + [...clashes].map(midiKeyLabel).join(', ') +
                    ', now bound to a control, so it can no longer be played as a note. Generate a new one.' };
            }
        }
        if (view.state === 'attempt') return { problem: false, text: HINTS.attempt(view.played.length) };
        return { problem: false, text: HINTS[view.state] || '' };
    }

    function showStatus(view) {
        const { problem, text } = statusMessage(view);
        status.classList.toggle('problem', problem);
        status.textContent = text;
        status.hidden = text === '';
    }

    // In review the passage carries the review's marks, and the review sits
    // beneath it.
    function showNotation(view) {
        notationEmpty.hidden = view.passage !== null;
        notation.hidden = view.passage === null;
        review.hidden = view.state !== 'review';
        if (!view.passage) return;
        const marks = view.state === 'review' ? SequenceReview.show(review, view.passage, view.played) : null;
        SequenceNotation.draw(notation, view.passage, marks);
    }

    function render() {
        const view = SequenceState.view();
        controls.generate.disabled = !view.canGenerate;
        controls.done.disabled = !view.canDone;
        controls.retry.disabled = !view.canRetry;
        controls.play.hidden = !view.canPlay;
        showStatus(view);
        showNotation(view);
    }

    // During an attempt only the status line changes with each note; the
    // passage itself is not redrawn while it is being read.
    let lastState = null;
    function changed() {
        const view = SequenceState.view();
        if (view.state === 'attempt' && lastState === 'attempt') {
            showStatus(view);
        } else {
            render();
        }
        lastState = view.state;
    }

    // Settings save shortly after the last change, as the chord trainer's do.
    let saveTimer = null;
    function settingsChanged() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => SequenceStore.saveSettings(settings), 300);
        SequenceState.clearProblem();
        showStatus(SequenceState.view());
    }

    controls.generate.addEventListener('click', () => SequenceState.generate());
    controls.done.addEventListener('click', () => SequenceState.done());
    controls.retry.addEventListener('click', () => SequenceState.retry());
    controls.play.addEventListener('click', () => SequenceState.play());

    // The notation is laid out for its width, so it is drawn again whenever
    // the width changes — not the height, which drawing itself changes.
    let drawnWidth = 0;
    new ResizeObserver(entries => {
        const width = Math.round(entries[0].contentRect.width);
        if (width !== drawnWidth) showNotation(SequenceState.view());
        drawnWidth = width;
    }).observe(notation.parentElement);

    SequenceState.start({
        settings: () => settings,
        boundMidi,
        changed,
        play: passage => SequencePlayback.play(passage, settings.tempo),
        stopPlayback: () => SequencePlayback.stop(),
    }, SequenceStore.loadPassage());

    // Bindings first, so an Escape they use to cancel learning a key is
    // already taken when the panel sees it.
    SequenceBindings.start({
        bindings: () => settings.bindings,
        command: name => SequenceState[name](),
        note: midi => SequenceState.note(midi),
        suspended: () => SequenceSettingsPanel.isOpen(),
    });
    SequenceSettingsPanel.start({ settings: () => settings, boundMidi, changed: settingsChanged });

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
