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
    const played = document.getElementById('played');

    const settings = SequenceStore.loadSettings();
    const boundMidi = () => new Set(Object.values(settings.bindings.midi).filter(key => key !== null));

    const HINTS = {
        shown: 'Read it through, then start playing: the first note starts the attempt.',
        attempt: count => 'Playing — ' + count + ' note' + (count === 1 ? '' : 's') + ' so far. Press Done when you have finished.',
        review: 'Retry the same passage, or generate a new one.',
    };

    // Browsers keep sound off until the page has been clicked or a computer
    // key pressed, and a MIDI key does not count. The first click or key
    // turns it on. Play pressed from the MIDI keyboard before that asks for
    // one click instead of playing silently.
    let soundBlocked = false;
    function allowSound() {
        getAudioCtx().resume().then(() => {
            document.removeEventListener('pointerdown', allowSound);
            document.removeEventListener('keydown', allowSound);
        }).catch(() => {});
    }
    document.addEventListener('pointerdown', allowSound);
    document.addEventListener('keydown', allowSound);

    // Inside a click or a computer key press, resuming the sound succeeds at
    // once. From a MIDI key it waits for the page's first click, and then
    // plays if the passage is still in review and nothing newer was asked.
    let playRequest = 0;
    function play(passage) {
        const context = getAudioCtx();
        if (context.state === 'running') { SequencePlayback.play(passage, settings.tempo); return; }
        const request = ++playRequest;
        context.resume().then(() => {
            if (request === playRequest && SequenceState.view().state === 'review') SequencePlayback.play(passage, settings.tempo);
        }).catch(() => {});
        setTimeout(() => {
            if (request !== playRequest || context.state === 'running') return;
            soundBlocked = true;
            showStatus(SequenceState.view());
        }, 250);
    }

    // A failure first, then blocked sound, then settings that cannot produce
    // a passage, then a passage that uses a key since bound to a control;
    // otherwise a hint.
    function statusMessage(view) {
        if (view.problem) return { problem: true, text: SequenceDisplay.failureText(view.problem) };
        if (soundBlocked) {
            return { problem: true, text: 'The browser has not allowed sound yet: click anywhere on the page, or press ' +
                'a key on the computer keyboard, once, and the passage will play.' };
        }
        const settingsProblem = SequenceGenerator.problems(settings, boundMidi());
        if (settingsProblem) return { problem: true, text: 'Settings: ' + SequenceDisplay.failureText(settingsProblem) };
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

    // Every redraw empties a panel before drawing it again. The page keeps
    // its height meanwhile, so it never gets shorter for a moment — which
    // would scroll the player away from what they were reading.
    function keepingHeight(redraw) {
        document.body.style.minHeight = document.body.offsetHeight + 'px';
        redraw();
        document.body.style.minHeight = '';
    }

    // The played panel filling in during an attempt, when the player has
    // asked for it. It never touches the passage itself.
    function showLiveReview(view) {
        const live = view.state === 'attempt' && settings.showPlayedLive;
        if (view.state !== 'review') played.hidden = !live;
        if (live) SequenceReview.showLive(played, view);
    }

    // In review the passage carries the review's marks, the review's counts
    // sit beneath it, and the played panel below that.
    function showNotation(view) {
        notationEmpty.hidden = view.passage !== null;
        notation.hidden = view.passage === null;
        review.hidden = view.state !== 'review';
        played.hidden = true;
        if (!view.passage) return;
        const marks = view.state === 'review' ? SequenceReview.show(review, played, view) : null;
        SequenceNotation.draw(notation, view.passage, { marks, chordNames: settings.showChordNames });
        showLiveReview(view);
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

    // During an attempt only the status line, and the live played staff if it
    // is on, change with each note; the passage itself is not redrawn while
    // it is being read.
    let lastState = null;
    function changed() {
        soundBlocked = false;
        playRequest++;
        const view = SequenceState.view();
        keepingHeight(() => {
            if (view.state === 'attempt' && lastState === 'attempt') {
                showStatus(view);
                showLiveReview(view);
            } else {
                render();
            }
        });
        lastState = view.state;
    }

    // Settings save shortly after the last change, as the chord trainer's do,
    // and at once if the page is left before that.
    let saveTimer = null;
    function saveSettings() {
        clearTimeout(saveTimer);
        saveTimer = null;
        SequenceStore.saveSettings(settings);
    }
    function settingsChanged() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveSettings, 300);
        SequenceState.clearProblem();
        showStatus(SequenceState.view());
    }
    window.addEventListener('pagehide', () => { if (saveTimer !== null) saveSettings(); });

    // A reading aid, as on a lead sheet: the chord of each bar named above it.
    const chordNamesCheckbox = document.getElementById('chordNamesCheckbox');
    chordNamesCheckbox.checked = settings.showChordNames;
    chordNamesCheckbox.addEventListener('change', () => {
        settings.showChordNames = chordNamesCheckbox.checked;
        settingsChanged();
        keepingHeight(() => showNotation(SequenceState.view()));
    });

    // Immediate feedback for those who want it: the played staff filling in as
    // each key goes down. Off by default, since a wrong key showing nothing
    // gives the answer away while reading.
    const playedLiveCheckbox = document.getElementById('playedLiveCheckbox');
    playedLiveCheckbox.checked = settings.showPlayedLive;
    playedLiveCheckbox.addEventListener('change', () => {
        settings.showPlayedLive = playedLiveCheckbox.checked;
        settingsChanged();
        keepingHeight(() => showLiveReview(SequenceState.view()));
    });

    // Settings imported from a file replace the current ones whole, and are
    // saved and shown at once.
    function replaceSettings(imported) {
        Object.assign(settings, imported);
        chordNamesCheckbox.checked = settings.showChordNames;
        playedLiveCheckbox.checked = settings.showPlayedLive;
        saveSettings();
        SequenceState.clearProblem();
        keepingHeight(render);
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
        if (width !== drawnWidth) keepingHeight(() => showNotation(SequenceState.view()));
        drawnWidth = width;
    }).observe(notation.parentElement);

    SequenceState.start({
        settings: () => settings,
        boundMidi,
        changed,
        play,
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
    SequenceSettingsPanel.start({ settings: () => settings, boundMidi, changed: settingsChanged, replaced: replaceSettings });
    SequenceReview.start({ redraw: () => keepingHeight(() => showNotation(SequenceState.view())) });

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
