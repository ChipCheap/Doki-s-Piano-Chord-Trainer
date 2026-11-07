// ═══════════════════════════════════════════════
//  SEQUENCE MODE — STORE (shell)
// ═══════════════════════════════════════════════

// Sequence Mode's two stored entries, under keys of its own, through the
// shared storage helpers:
//
//   settings — { version, parameters, timeSignature, tempo, showChordNames,
//                showPlayedLive, bindings }
//   passage  — the passage on screen, so a reload brings it back
//
// Whatever is read back is checked whole first, so nothing else ever sees a
// malformed value. Settings from an older version go through a converter;
// a passage from another version is simply dropped, since a new one costs
// nothing. An attempt is never stored: a reload starts it over.
const SequenceStore = (() => {
    const SETTINGS_KEY = 'sequenceModeSettings';
    const PASSAGE_KEY = 'sequenceModePassage';
    const SETTINGS_VERSION = 1;
    // Converters from each older settings version to the next, by the version
    // they convert from. None yet: version 1 is the first.
    const CONVERTERS = {};

    const COMMANDS = ['generate', 'done', 'retry', 'play'];
    const TEMPO = { lowest: 60, highest: 120, initial: 80 };

    function defaultSettings() {
        return {
            parameters: SequenceDifficulty.presetParameters(SequenceDifficulty.DEFAULT_PRESET),
            timeSignature: '4/4',
            tempo: TEMPO.initial,
            showChordNames: false,
            showPlayedLive: false,
            bindings: {
                computer: { generate: 'KeyN', done: 'Enter', retry: 'KeyR', play: 'KeyP' },
                midi: { generate: null, done: null, retry: null, play: null },
            },
        };
    }

    function readJson(key) {
        const text = readStored(key);
        if (text === null) return null;
        try { return JSON.parse(text); } catch { return null; }
    }

    // One method's bindings: each command keeps its stored key if it is of the
    // right kind and no earlier command already took it.
    function bindingTable(stored, fallback, isKey) {
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        const taken = new Set();
        return Object.fromEntries(COMMANDS.map(command => {
            const value = command in source ? source[command] : fallback[command];
            const usable = value === null || (isKey(value) && !taken.has(value));
            if (usable && value !== null) taken.add(value);
            return [command, usable ? value : null];
        }));
    }

    function sanitizeSettings(stored) {
        const defaults = defaultSettings();
        const source = stored !== null && typeof stored === 'object' ? stored : {};
        const bindings = source.bindings !== null && typeof source.bindings === 'object' ? source.bindings : {};
        const tempo = Number.isInteger(source.tempo) && source.tempo >= TEMPO.lowest && source.tempo <= TEMPO.highest
            ? source.tempo : defaults.tempo;
        return {
            parameters: SequenceDifficulty.sanitize(source.parameters),
            timeSignature: SequenceMeter.TIME_SIGNATURES[source.timeSignature] ? source.timeSignature : defaults.timeSignature,
            tempo,
            showChordNames: typeof source.showChordNames === 'boolean' ? source.showChordNames : defaults.showChordNames,
            showPlayedLive: typeof source.showPlayedLive === 'boolean' ? source.showPlayedLive : defaults.showPlayedLive,
            bindings: {
                computer: bindingTable(bindings.computer, defaults.bindings.computer,
                    value => typeof value === 'string' && value.length > 0),
                midi: bindingTable(bindings.midi, defaults.bindings.midi,
                    value => Number.isInteger(value) && value >= SequencePitch.MIDI_LOWEST && value <= SequencePitch.MIDI_HIGHEST),
            },
        };
    }

    // Settings from their stored form, converted from an older version first,
    // or null when they are not settings this version can read.
    function settingsFrom(stored) {
        if (stored === null || typeof stored !== 'object') return null;
        let converted = stored;
        let version = stored.version;
        while (Number.isInteger(version) && version < SETTINGS_VERSION && CONVERTERS[version]) {
            converted = CONVERTERS[version](converted);
            version++;
        }
        return version === SETTINGS_VERSION ? sanitizeSettings(converted) : null;
    }

    // The stored form: the settings with their version.
    function storedSettings(settings) {
        return { version: SETTINGS_VERSION, ...settings };
    }

    function loadSettings() {
        return settingsFrom(readJson(SETTINGS_KEY)) ?? defaultSettings();
    }

    function saveSettings(settings) {
        return writeStored(SETTINGS_KEY, JSON.stringify(storedSettings(settings)));
    }

    function loadPassage() {
        const stored = readJson(PASSAGE_KEY);
        return SequencePassage.isValid(stored) ? stored : null;
    }

    function savePassage(passage) {
        return writeStored(PASSAGE_KEY, JSON.stringify(passage));
    }

    return { COMMANDS, TEMPO, settingsFrom, storedSettings, loadSettings, saveSettings, loadPassage, savePassage };
})();
