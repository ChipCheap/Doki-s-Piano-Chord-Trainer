// ═══════════════════════════════════════════════
//  SEQUENCE MODE — PAGE BOOTSTRAP (shell)
// ═══════════════════════════════════════════════

// Loaded last: wires the page's controls to the core and the notation. It
// exposes nothing; everything it needs is already loaded.
(() => {
    const notation = document.getElementById('notation');
    const notationEmpty = document.getElementById('notationEmpty');
    let passage = null;

    function show() {
        notationEmpty.hidden = passage !== null;
        notation.hidden = passage === null;
        if (passage) SequenceNotation.draw(notation, passage);
    }

    document.getElementById('generateBtn').addEventListener('click', () => {
        const parameters = SequenceDifficulty.presetParameters(SequenceDifficulty.DEFAULT_PRESET);
        const result = SequenceGenerator.generate({ parameters, timeSignature: '4/4' }, new Set(), Math.random);
        if (result.passage) passage = result.passage;
        show();
    });

    // The notation is laid out for its width, so it is drawn again whenever
    // the width changes — not the height, which drawing itself changes.
    let drawnWidth = 0;
    new ResizeObserver(entries => {
        const width = Math.round(entries[0].contentRect.width);
        if (width !== drawnWidth && passage) show();
        drawnWidth = width;
    }).observe(notation.parentElement);

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    show();
})();
