// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PAGE BOOTSTRAP (shell)
// ═══════════════════════════════════════════════

// Loaded last: wires the page to the store, the state owner and playback, and
// draws everything from the state owner's view. It exposes nothing; every
// part it needs is already loaded.
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

    const settings = SequenceStore.loadSettings();
    const boundMidi = () => new Set(Object.values(settings.bindings.midi).filter(key => key !== null));

    const HINTS = {
        shown: 'Read it through, then start playing: the first note starts the attempt.',
        attempt: count => 'Playing — ' + count + ' note' + (count === 1 ? '' : 's') + ' so far. Press Done when you have finished.',
        review: 'Retry the same passage, or generate a new one.',
    };

    function showStatus(view) {
        status.classList.toggle('problem', view.problem !== null);
        if (view.problem) {
            const keys = view.problem.keys.map(midiKeyLabel).join(', ');
            status.textContent = view.problem.message + (keys ? ' ' + keys : '');
        } else if (view.state === 'attempt') {
            status.textContent = HINTS.attempt(view.played.length);
        } else {
            status.textContent = HINTS[view.state] || '';
        }
        status.hidden = status.textContent === '';
    }

    function showNotation(view) {
        notationEmpty.hidden = view.passage !== null;
        notation.hidden = view.passage === null;
        if (view.passage) SequenceNotation.draw(notation, view.passage);
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

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
