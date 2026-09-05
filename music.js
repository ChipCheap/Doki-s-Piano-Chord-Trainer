// ═══════════════════════════════════════════════
//  MUSIC DATA & THEORY
// ═══════════════════════════════════════════════

const CHORD_TYPES = {
    'Major':           {semitones:[0,4,7],        intervals:'1-3-5',         formula:'R+4+3',       quality:'Major'},
    'Minor':           {semitones:[0,3,7],        intervals:'1-b3-5',        formula:'R+3+4',       quality:'Minor'},
    'Diminished':      {semitones:[0,3,6],        intervals:'1-b3-b5',       formula:'R+3+3',       quality:'Diminished'},
    'Augmented':       {semitones:[0,4,8],        intervals:'1-3-♯5',        formula:'R+4+4',       quality:'Augmented'},
    'Sus2':            {semitones:[0,2,7],        intervals:'1-2-5',         formula:'R+2+5',       quality:'Suspended'},
    'Sus4':            {semitones:[0,5,7],        intervals:'1-4-5',         formula:'R+5+2',       quality:'Suspended'},
    'Major 7th':       {semitones:[0,4,7,11],     intervals:'1-3-5-7',       formula:'R+4+3+4',     quality:'Major 7th'},
    'Minor 7th':       {semitones:[0,3,7,10],     intervals:'1-b3-5-b7',     formula:'R+3+4+3',     quality:'Minor 7th'},
    'Dominant 7th':    {semitones:[0,4,7,10],     intervals:'1-3-5-b7',      formula:'R+4+3+3',     quality:'Dom 7th'},
    'Minor Major 7th': {semitones:[0,3,7,11],     intervals:'1-b3-5-7',      formula:'R+3+4+4',     quality:'Min Maj 7'},
    'Half Dim 7th':    {semitones:[0,3,6,10],     intervals:'1-b3-b5-b7',    formula:'R+3+3+4',     quality:'Half Dim'},
    'Diminished 7th':  {semitones:[0,3,6,9],      intervals:'1-b3-b5-bb7',   formula:'R+3+3+3',     quality:'Dim 7th'},
    'Augmented 7th':   {semitones:[0,4,8,10],     intervals:'1-3-♯5-b7',     formula:'R+4+4+2',     quality:'Aug 7th'},
    'Aug Maj 7th':     {semitones:[0,4,8,11],     intervals:'1-3-♯5-7',      formula:'R+4+4+3',     quality:'Aug Maj 7'},
    'Add 9':           {semitones:[0,4,7,14],     intervals:'1-3-5-9',       formula:'R+4+3+7',     quality:'Add9'},
    'Major 9th':       {semitones:[0,4,7,11,14],  intervals:'1-3-5-7-9',     formula:'R+4+3+4+3',   quality:'Major 9th'},
    'Minor 9th':       {semitones:[0,3,7,10,14],  intervals:'1-b3-5-b7-9',   formula:'R+3+4+3+4',   quality:'Minor 9th'},
    'Dominant 9th':    {semitones:[0,4,7,10,14],  intervals:'1-3-5-b7-9',    formula:'R+4+3+3+4',   quality:'Dom 9th'},
    'Major 11th':      {semitones:[0,4,7,11,14,17],    intervals:'1-3-5-7-9-11',      formula:'R+4+3+4+3+3', quality:'Major 11'},
    'Dominant 11th':   {semitones:[0,4,7,10,14,17],    intervals:'1-3-5-b7-9-11',     formula:'R+4+3+3+4+3', quality:'Dom 11'},
    'Major 13th':      {semitones:[0,4,7,11,14,17,21], intervals:'1-3-5-7-9-11-13',   formula:'R+4+3+4+3+4', quality:'Major 13'},
    'Dominant 13th':   {semitones:[0,4,7,10,14,17,21], intervals:'1-3-5-b7-9-11-13',  formula:'R+4+3+3+4+4', quality:'Dom 13'},
    'Power (5th)':     {semitones:[0,7],          intervals:'1-5',           formula:'R+7',         quality:'Power'},
};

const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_NAMES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const BASE_NOTES       = ['C','D','E','F','G','A','B'];
const ALL_ROOT_NOTES   = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];

function getAugmentMidiValue(augment) {
    if (augment === 'x') return  2;
    if (augment === '#') return  1;
    if (augment === 'b') return -1;
    if (augment === 'V') return -2;
    return 0;
}

class Note {
    constructor(name, octave, augment) {
        this.name   = name;
        this.octave = octave;
        this.augment = augment;
        // C4 = midi 60 = (4+1)*12 + 0
        this.midi = (octave + 1) * 12 + NOTE_NAMES_SHARP.indexOf(name) + getAugmentMidiValue(augment);
    }
}

function determineNotes(rootFullNote, intervals, semitones) {
    let finalNotes = new Array(rootFullNote);
    let intervalNumbers = intervals.split('-').map(interval => interval.replace(/\D/g, ''));
    const rootNoteBaseIndex = BASE_NOTES.indexOf(rootFullNote.name);
    let splicedIntervalNumbers = intervalNumbers.splice(1);
    const chordBaseNotes = splicedIntervalNumbers.map(s =>
        BASE_NOTES[(rootNoteBaseIndex + parseInt(s, 10) - 1) % 7]
    );

    for (let i = 0; i < semitones.length - 1; i++) {
        let distanceToDesiredNote = (
            NOTE_NAMES_SHARP.indexOf(chordBaseNotes[i]) + 12 -
            Math.max(
                NOTE_NAMES_SHARP.indexOf(rootFullNote.name + rootFullNote.augment),
                NOTE_NAMES_FLAT.indexOf(rootFullNote.name + rootFullNote.augment)
            )
        ) % 12 - semitones[i + 1] % 12;

        let augment = '';
        if      (distanceToDesiredNote === -2) augment = 'x';
        else if (distanceToDesiredNote === -1) augment = '#';
        else if (distanceToDesiredNote ===  1) augment = 'b';
        else if (distanceToDesiredNote !== 0)  augment = 'V';

        const newOctave = BASE_NOTES.indexOf(rootFullNote.name) > BASE_NOTES.indexOf(chordBaseNotes[i]) ? 1 : 0;
        finalNotes.push(new Note(
            chordBaseNotes[i],
            rootFullNote.octave + Math.floor(parseInt(splicedIntervalNumbers[i]) / 8) + newOctave,
            augment
        ));
    }
    return finalNotes;
}

// ── Inversions ────────────────────────────────
// Inversion names for the UI. Index 0 = root position.
const INVERSION_NAMES = [
    'Root Position',
    '1st Inversion', '2nd Inversion', '3rd Inversion',
    '4th Inversion', '5th Inversion', '6th Inversion',
];

// Apply n inversions to a note array: each rotation moves the lowest
// note to the top and bumps its octave by 1.
function applyInversion(notes, n) {
    const result = [...notes];
    for (let i = 0; i < n; i++) {
        // Lift the genuinely lowest note, not just the array head. Within
        // inversionCount() they are always the same note, but relying on
        // position alone breaks silently if that cap ever widens.
        let lowest = 0;
        for (let j = 1; j < result.length; j++) {
            if (result[j].midi < result[lowest].midi) lowest = j;
        }
        const src = result[lowest];
        result.splice(lowest, 1);
        result.push(new Note(src.name, src.octave + 1, src.augment));
    }
    return result;
}

// How many inversions a chord actually has. Standard harmony names inversions
// by which chord tone is in the bass and stops at the third (seventh in the
// bass): the 9th, 11th and 13th are upper-structure tones, and a voicing with
// one of them in the bass reads as a different chord rather than an inversion.
// A tone can take the bass only if it lies within an octave of the root.
function inversionCount(chordDef) {
    return chordDef.semitones.filter(s => s < 12).length;
}

// ── Display helpers ───────────────────────────
// Diatonic staff position: one step per line/space, accidentals ignored. Read
// from the spelling rather than the MIDI number, so B#4 and Cb4 sit on the B
// and C positions instead of on their enharmonic neighbours.
function diatonicStep(note) {
    return note.octave * 7 + BASE_NOTES.indexOf(note.name);
}

// 'V' is the internal double-flat code. 'x' is already the conventional text
// shorthand for a double sharp, so it passes through unchanged.
function noteLabel(note) {
    return note.name + (note.augment === 'V' ? 'bb' : note.augment);
}
