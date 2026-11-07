// ═══════════════════════════════════════════════
//  SETTINGS FILE — shared by every page
// ═══════════════════════════════════════════════

// One exported file holds both modes' settings, so a whole setup is kept in,
// and restored on either page from, a single file:
//
//   { version: 2, chordTrainer: <chord trainer settings>, sequenceMode: <Sequence Mode settings> }
//
// Each part is its mode's settings in their stored form, or null when that
// mode has never saved any. The page exporting gives its own settings as they
// stand; the other mode's come from storage. On import the page checks and
// applies its own part; the other mode's part is stored as it is, and checked
// whole when that page next loads. This file knows only the modes' storage
// keys and never calls a mode's code (architecture.md, D14).
//
// Version 1 is the chord trainer's older file: its settings alone at the top
// level, with no version. It imports as the chord trainer's part.
const SettingsFile = (() => {
    const STORAGE_KEYS = { chordTrainer: 'pianoChordSettings', sequenceMode: 'sequenceModeSettings' };
    const VERSION = 2;
    const FILE_NAME = 'doki-piano-settings.json';

    function isSettingsObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function storedPart(mode) {
        const text = readStored(STORAGE_KEYS[mode]);
        if (text === null) return null;
        try { return JSON.parse(text); } catch (error) { return null; }
    }

    // Downloads the file. `mode` is the exporting page's name in
    // STORAGE_KEYS, `settings` its settings in stored form.
    function exportFile(mode, settings) {
        const file = { version: VERSION };
        for (const part of Object.keys(STORAGE_KEYS)) file[part] = part === mode ? settings : storedPart(part);
        const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = FILE_NAME;
        link.click();
        URL.revokeObjectURL(url);
    }

    // A file's text as its parts by mode, or null when it is not a settings
    // file this version can read.
    function parts(text) {
        let file;
        try { file = JSON.parse(text); } catch (error) { return null; }
        if (!isSettingsObject(file)) return null;
        if (!('version' in file)) return { chordTrainer: file, sequenceMode: null };
        if (file.version !== VERSION) return null;
        return Object.fromEntries(Object.keys(STORAGE_KEYS).map(part =>
            [part, isSettingsObject(file[part]) ? file[part] : null]));
    }

    // Reads `file`, chosen in a file input, on the page of `mode`.
    // `apply(part)` is given that page's own part, when the file has one, and
    // returns whether it could use it. Only then is the other mode's part
    // stored. Resolves to whether the file was imported.
    function importFile(file, mode, apply) {
        return file.text().then(text => {
            const fileParts = parts(text);
            if (fileParts === null || (fileParts[mode] !== null && !apply(fileParts[mode]))) return false;
            for (const [part, settings] of Object.entries(fileParts)) {
                if (part !== mode && settings !== null) writeStored(STORAGE_KEYS[part], JSON.stringify(settings));
            }
            return true;
        }).catch(() => false);
    }

    return { STORAGE_KEYS, exportFile, importFile };
})();
