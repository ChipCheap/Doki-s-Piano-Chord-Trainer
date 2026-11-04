// ═══════════════════════════════════════════════
//  SEQUENCE MODE — STATE OWNER (shell)
// ═══════════════════════════════════════════════

// The only place the mode's state changes, and only along the framework's
// transition table:
//
//   empty    ─generate→ shown
//   shown    ─generate→ shown (new passage)   ─first note→ attempt
//   attempt  ─done→ review                    ─retry→ shown (same passage)
//   review   ─retry→ shown (same passage)     ─generate→ shown (new passage)
//
// Anything else — generate during an attempt, done or retry with no attempt,
// play outside review, notes outside a passage or an attempt — does nothing.
// After every change the page redraws from `view()`; nothing else is kept
// anywhere about what is going on.
const SequenceState = (() => {
    let state = 'empty';
    let passage = null;
    let played = [];
    let problem = null;
    let hooks = null;

    // hooks: { settings(), boundMidi(), changed(), play(passage), stopPlayback() }.
    // A restored passage starts shown; without one the mode starts empty.
    function start(pageHooks, restoredPassage) {
        hooks = pageHooks;
        if (restoredPassage) {
            passage = restoredPassage;
            state = 'shown';
        }
        hooks.changed();
    }

    function leaveReview() {
        if (state === 'review') hooks.stopPlayback();
    }

    function generate() {
        if (state === 'attempt') return;
        const settings = hooks.settings();
        const result = SequenceGenerator.generate(
            { parameters: settings.parameters, timeSignature: settings.timeSignature }, hooks.boundMidi(), Math.random);
        if (result.failure) {
            // A failure leaves everything as it was, apart from saying why.
            problem = result.failure;
        } else {
            leaveReview();
            passage = result.passage;
            played = [];
            problem = null;
            state = 'shown';
            SequenceStore.savePassage(passage);
        }
        hooks.changed();
    }

    // A played key, never a command: bindings have already been taken out.
    function note(midi) {
        if (state === 'shown') {
            state = 'attempt';
            played = [midi];
        } else if (state === 'attempt') {
            played.push(midi);
        } else {
            return;
        }
        hooks.changed();
    }

    function done() {
        if (state !== 'attempt') return;
        state = 'review';
        hooks.changed();
    }

    function retry() {
        if (state !== 'attempt' && state !== 'review') return;
        leaveReview();
        played = [];
        state = 'shown';
        hooks.changed();
    }

    function play() {
        if (state === 'review') hooks.play(passage);
    }

    // What the page needs to draw: which commands are possible now included.
    function view() {
        return {
            state, passage, problem,
            played: [...played],
            canGenerate: state !== 'attempt',
            canDone: state === 'attempt',
            canRetry: state === 'attempt' || state === 'review',
            canPlay: state === 'review',
        };
    }

    // Settings changed elsewhere can make an old failure message stale.
    function clearProblem() {
        if (!problem) return;
        problem = null;
        hooks.changed();
    }

    return { start, generate, note, done, retry, play, view, clearProblem };
})();
