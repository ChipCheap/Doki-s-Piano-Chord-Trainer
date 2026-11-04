// ═══════════════════════════════════════════════
//  SEQUENCE MODE — SHARED DISPLAY HELPERS (shell)
// ═══════════════════════════════════════════════

// The small pieces of page building that more than one shell file needs.
const SequenceDisplay = (() => {
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // A failure from the generator as one sentence, with the bound keys
    // involved named as the MIDI panel names keys.
    function failureText(failure) {
        return failure.message + (failure.keys.length ? ' ' + failure.keys.map(midiKeyLabel).join(', ') : '');
    }

    return { element, failureText };
})();
