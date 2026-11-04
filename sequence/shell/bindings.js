// ═══════════════════════════════════════════════
//  SEQUENCE MODE — CONTROL BINDINGS (shell)
// ═══════════════════════════════════════════════

// Every key press, from the computer keyboard or the MIDI keyboard, passes
// through here first, and exactly here it is decided whether it is a command
// or a played note. A key bound to a command never becomes a played note; the
// generator is told which MIDI keys are bound and never writes them. Only
// which key went down is used: never when, how hard, or for how long.
const SequenceBindings = (() => {
    let hooks = null;
    // While a binding is being learnt, the next key of that method is the new
    // binding and nothing else.
    let learning = null;

    const NAMED_KEYS = { Space: 'Space', Enter: 'Enter', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };

    function commandFor(table, key) {
        return SequenceStore.COMMANDS.find(command => table[command] === key) || null;
    }

    function finishLearning(key) {
        const { onLearned } = learning;
        learning = null;
        onLearned(key);
    }

    function midiPressed(note) {
        if (learning && learning.method === 'midi') { finishLearning(note); return; }
        if (hooks.suspended()) return;
        const command = commandFor(hooks.bindings().midi, note);
        if (command) hooks.command(command);
        else hooks.note(note);
    }

    // Only fields that take typed text; a checkbox or slider with the focus
    // does not stop the controls.
    const TEXT_INPUT_TYPES = ['text', 'search', 'email', 'number', 'password', 'tel', 'url'];
    function isTyping(target) {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return true;
        return target.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes(target.type);
    }

    function isActivatable(target) {
        return target instanceof HTMLElement && (['A', 'BUTTON', 'SUMMARY'].includes(target.tagName) ||
            target.getAttribute('role') === 'button');
    }

    function keyPressed(event) {
        if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
        if (learning && learning.method === 'computer') {
            event.preventDefault();
            if (event.code === 'Escape') {
                const { onCancelled } = learning;
                learning = null;
                onCancelled();
            } else {
                finishLearning(event.code);
            }
            return;
        }
        if (hooks.suspended() || isTyping(event.target)) return;
        // Enter and Space keep their own job on a focused link or button, so
        // the page stays usable from the keyboard: Enter still follows the
        // link back to the chord trainer even though it is bound to Done.
        if ((event.code === 'Enter' || event.code === 'Space') && isActivatable(event.target)) return;
        const command = commandFor(hooks.bindings().computer, event.code);
        if (!command) return;
        event.preventDefault();
        hooks.command(command);
    }

    // hooks: { bindings(), command(name), note(midi), suspended() }.
    function start(pageHooks) {
        hooks = pageHooks;
        midiAddListener({ notePressed: midiPressed });
        document.addEventListener('keydown', keyPressed);
    }

    // The next key of `method` ('computer' or 'midi') is handed to onLearned.
    // Escape on the computer keyboard gives up instead, calling onCancelled.
    function learn(method, onLearned, onCancelled) {
        learning = { method, onLearned, onCancelled };
    }

    function cancelLearning() {
        learning = null;
    }

    // Binds `key` to `command` in one method's table. A key already bound to
    // another command moves, so no key ever has two commands.
    function assign(table, command, key) {
        for (const other of SequenceStore.COMMANDS) if (table[other] === key) table[other] = null;
        table[command] = key;
    }

    function label(method, key) {
        if (key === null) return '—';
        if (method === 'midi') return midiKeyLabel(key);
        return NAMED_KEYS[key] || key.replace(/^(Key|Digit|Numpad)/, '');
    }

    return { start, learn, cancelLearning, assign, label };
})();
