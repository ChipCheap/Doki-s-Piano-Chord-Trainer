// ═══════════════════════════════════════════════
//  SEQUENCE MODE — NOTATION ADAPTER (shell)
// ═══════════════════════════════════════════════

// The only file that talks to VexFlow. It draws a passage as a grand staff and
// can mark individual notes for the review. What to draw — spellings, which
// accidentals show, how eighths group — comes from the core; VexFlow only
// engraves it. Its own automatic accidentals are never used.
const SequenceNotation = (() => {
    const Flow = Vex.Flow;

    // One system of four bars from this width up, when every bar fits its
    // quarter; otherwise two systems of two — never one bar at a time.
    const ONE_SYSTEM_FROM = 760;
    // Drawing coordinates are laid out at least this wide, or wider if two
    // bars need it, and then scaled to the container, so a phone gets a
    // smaller passage rather than a cramped or scrolling one.
    const LAYOUT_MIN_WIDTH = 620;
    // Tall enough for the hand ranges difficulty.js allows: three ledger
    // lines above the treble staff, two below the bass.
    const SYSTEM_HEIGHT = 240;
    // Extra room above each line for the chord names, when they are shown.
    const CHORD_NAME_ROOM = 32;
    const CHORD_NAME_FONT = { family: 'Georgia, serif', size: 15, weight: 'bold' };
    const STAFF_GAP = 105;
    const MARGIN = 16;
    // Room a bar's notes need beyond VexFlow's own minimum, so neighbouring
    // notes and accidentals never touch.
    const BAR_PADDING = 30;
    // The sequence of played notes: room per column of notes played
    // together, and the lowest staff step that belongs on the treble staff
    // (middle C).
    const SEQUENCE_NOTE_WIDTH = 34;
    const TREBLE_LOWEST_STEP = 28;

    // Dotted values carry the dot in the duration, which is what gives them
    // their length; the drawn dot is attached separately.
    const VEX_DURATIONS = { 1: '8', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd' };
    const DOTTED = new Set([3, 6]);
    const ACCIDENTAL_GLYPHS = { '-2': 'bb', '-1': 'b', '0': 'n', '1': '#', '2': '##' };
    // A rest sits in the middle of its staff.
    const REST_KEYS = { right: 'b/4', left: 'd/3' };

    // The review's marks, colour and symbol together so colour is never the
    // only signal: a right note is blue and plain, every kind of mistake has a
    // symbol of its own above the note. Colours follow the chord trainer's
    // keyboard; notes not reached are only greyed.
    const MARK_STYLES = {
        matched: { colour: '#1a3a8b', symbol: '' },
        missed: { colour: '#8b1a1a', symbol: '✗' },
        wrong: { colour: '#8a6d1f', symbol: '≠' },
        outOfOrder: { colour: '#2a6a6a', symbol: '↔' },
        notAttempted: { colour: '#a89a80', symbol: '' },
    };
    const SYMBOL_ORDER = ['missed', 'wrong', 'outOfOrder'];

    function vexKey(pitch) {
        return pitch.letter.toLowerCase() + '/' + pitch.octave;
    }

    // The major key sharing this signature, by the name VexFlow expects.
    function signatureName(key) {
        const major = SequenceTheory.KEYS.find(candidate => candidate.mode === 'major' && candidate.signature === key.signature);
        return major.tonic.letter + ({ '-1': 'b', '0': '', '1': '#' })[major.tonic.alteration];
    }

    // One staff of one bar as VexFlow notes, with the accidentals the core
    // decided and the marks the review asked for.
    function staffNotes(passage, events, staff, marks) {
        const clef = staff === 'right' ? 'treble' : 'bass';
        const shown = SequenceTheory.displayedAccidentals(passage.key, events.flatMap(event => event.pitches));
        let shownIndex = 0;
        return events.map(event => {
            const rest = event.pitches.length === 0;
            const note = new Flow.StaveNote({
                clef,
                keys: rest ? [REST_KEYS[staff]] : event.pitches.map(vexKey),
                duration: VEX_DURATIONS[event.duration] + (rest ? 'r' : ''),
                auto_stem: !rest,
            });
            if (DOTTED.has(event.duration)) Flow.Dot.buildAndAttach([note], { all: true });
            event.pitches.forEach((pitch, keyIndex) => {
                const accidental = shown[shownIndex++];
                if (accidental !== null) note.addModifier(new Flow.Accidental(ACCIDENTAL_GLYPHS[accidental]), keyIndex);
                const mark = marks && marks.get(pitch);
                if (mark) note.setKeyStyle(keyIndex, { fillStyle: MARK_STYLES[mark].colour, strokeStyle: MARK_STYLES[mark].colour });
            });
            // One symbol per kind of mistake in the chord, most serious first.
            const kinds = SYMBOL_ORDER.filter(kind => event.pitches.some(pitch => marks && marks.get(pitch) === kind));
            if (kinds.length) {
                const annotation = new Flow.Annotation(kinds.map(kind => MARK_STYLES[kind].symbol).join(''))
                    .setVerticalJustification(Flow.Annotation.VerticalJustify.TOP);
                annotation.setStyle({ fillStyle: MARK_STYLES[kinds[0]].colour });
                note.addModifier(annotation, 0);
            }
            return note;
        });
    }

    // Beams for one staff of a bar, decided from the meter rather than left to
    // VexFlow: every run of two or more eighth notes inside the same beam
    // window (meter.js's beamLength) shares a beam; a rest or a longer note
    // breaks the run. Each beam turns all its stems the same way, chosen from
    // the notes' average position, as engraving does.
    function staffBeams(events, notes, beamLength) {
        const beams = [];
        let run = [];
        let runWindow = null;
        const close = () => {
            if (run.length >= 2) beams.push(new Flow.Beam(run, true));
            run = [];
        };
        events.forEach((event, index) => {
            const window = Math.floor(event.position / beamLength);
            if (event.duration !== SequenceMeter.DURATIONS.eighth || event.pitches.length === 0) { close(); return; }
            if (window !== runWindow) close();
            run.push(notes[index]);
            runWindow = window;
        });
        close();
        return beams;
    }

    // Both staves of one bar as VexFlow voices, with their beams.
    function barVoices(passage, bar, marks, meter) {
        const rightNotes = staffNotes(passage, bar.right, 'right', marks);
        const leftNotes = staffNotes(passage, bar.left, 'left', marks);
        const timing = { num_beats: meter.beats, beat_value: meter.beatValue };
        return {
            voices: [new Flow.Voice(timing).addTickables(rightNotes), new Flow.Voice(timing).addTickables(leftNotes)],
            beams: [...staffBeams(bar.right, rightNotes, meter.beamLength),
                    ...staffBeams(bar.left, leftNotes, meter.beamLength)],
        };
    }

    // The narrowest a bar's notes can be set without colliding, measured on
    // a copy of its notes so the drawn ones are formatted only once.
    function minimumWidth(passage, bar, meter) {
        const { voices } = barVoices(passage, bar, null, meter);
        const formatter = new Flow.Formatter().joinVoices([voices[0]]).joinVoices([voices[1]]);
        return formatter.preCalculateMinTotalWidth(voices) + BAR_PADDING;
    }

    function staves(key, meter, x, top, width, opening, withTime) {
        const treble = new Flow.Stave(x, top, width);
        const bass = new Flow.Stave(x, top + STAFF_GAP, width);
        if (opening) {
            treble.addClef('treble').addKeySignature(signatureName(key));
            bass.addClef('bass').addKeySignature(signatureName(key));
            if (withTime) {
                treble.addTimeSignature(meter.beats + '/' + meter.beatValue);
                bass.addTimeSignature(meter.beats + '/' + meter.beatValue);
            }
        }
        // Both staves start their notes at the same x, so the hands line up
        // even though a treble and a bass clef differ in width.
        const noteStart = Math.max(treble.getNoteStartX(), bass.getNoteStartX());
        treble.setNoteStartX(noteStart);
        bass.setNoteStartX(noteStart);
        return { treble, bass };
    }

    // How much wider than a plain bar a system's first bar is, for its clefs,
    // key signature and — on the first system — time signature.
    function openingWidth(key, meter, withTime) {
        const plain = staves(key, meter, 0, 0, 500, false, false).treble.getNoteStartX();
        return staves(key, meter, 0, 0, 500, true, withTime).treble.getNoteStartX() - plain;
    }

    // Draws `passage` into `container`, replacing whatever was there.
    // options.marks, optional, maps passage pitch objects to a status from
    // SequenceComparison ('matched', 'missed', 'wrong', 'outOfOrder',
    // 'notAttempted'); options.chordNames puts each bar's chord symbol above it.
    function draw(container, passage, options) {
        const { marks = null, chordNames = false } = options || {};
        const lineHeight = SYSTEM_HEIGHT + (chordNames ? CHORD_NAME_ROOM : 0);
        container.innerHTML = '';
        const meter = SequenceMeter.meter(passage.timeSignature);
        const widest = Math.max(...passage.bars.map(bar => minimumWidth(passage, bar, meter)));
        const firstOpening = openingWidth(passage.key, meter, true);
        const laterOpening = openingWidth(passage.key, meter, false);

        const available = Math.max(1, container.clientWidth);
        const oneSystemFits = available >= ONE_SYSTEM_FROM && (available - 2 * MARGIN - firstOpening) / 4 >= widest;
        const barsPerSystem = oneSystemFits ? 4 : 2;
        const layoutWidth = Math.max(available, LAYOUT_MIN_WIDTH,
                                     Math.ceil(2 * MARGIN + firstOpening + barsPerSystem * widest));
        const systems = passage.bars.length / barsPerSystem;
        const layoutHeight = systems * lineHeight;

        const renderer = new Flow.Renderer(container, Flow.Renderer.Backends.SVG);
        renderer.resize(layoutWidth, layoutHeight);
        const context = renderer.getContext();
        const svg = container.querySelector('svg');
        // VexFlow fixes the drawing's size in pixels; the view box lets it scale
        // to the container's width instead, so it never scrolls or clips.
        svg.setAttribute('viewBox', '0 0 ' + layoutWidth + ' ' + layoutHeight);
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Passage in ' + SequenceTheory.keyLabel(passage.key) + ', ' + passage.timeSignature);

        const usable = layoutWidth - 2 * MARGIN;
        for (let system = 0; system < systems; system++) {
            const top = system * lineHeight + 20 + (chordNames ? CHORD_NAME_ROOM : 0);
            const opening = system === 0 ? firstOpening : laterOpening;
            const barWidth = (usable - opening) / barsPerSystem;
            let x = MARGIN;

            for (let column = 0; column < barsPerSystem; column++) {
                const barIndex = system * barsPerSystem + column;
                const last = barIndex === passage.bars.length - 1;
                const width = barWidth + (column === 0 ? opening : 0);
                const { treble, bass } = staves(passage.key, meter, x, top, width, column === 0, system === 0);
                if (last) {
                    treble.setEndBarType(Flow.Barline.type.END);
                    bass.setEndBarType(Flow.Barline.type.END);
                }
                treble.setContext(context).draw();
                bass.setContext(context).draw();
                if (chordNames) {
                    context.save();
                    context.setFont(CHORD_NAME_FONT.family, CHORD_NAME_FONT.size, CHORD_NAME_FONT.weight);
                    context.fillText(SequenceTheory.chordSymbol(passage.key, passage.bars[barIndex].chord),
                                     treble.getNoteStartX(), top - 14);
                    context.restore();
                }

                if (column === 0) {
                    new Flow.StaveConnector(treble, bass).setType('brace').setContext(context).draw();
                    new Flow.StaveConnector(treble, bass).setType('singleLeft').setContext(context).draw();
                }
                new Flow.StaveConnector(treble, bass).setType(last ? 'boldDoubleRight' : 'singleRight').setContext(context).draw();

                const { voices, beams } = barVoices(passage, passage.bars[barIndex], marks, meter);
                new Flow.Formatter().joinVoices([voices[0]]).joinVoices([voices[1]])
                    .format(voices, treble.getNoteEndX() - treble.getNoteStartX() - 10);
                voices[0].draw(context, treble);
                voices[1].draw(context, bass);
                beams.forEach(beam => beam.setContext(context).draw());
                x += width;
            }
        }
    }

    // One staff's notehead stack for a column of the played sequence, or a
    // silent placeholder when none of the column's notes belong on it. The
    // pitches go lowest first, the order VexFlow numbers a chord's heads in,
    // so each accidental lands on its own note.
    function sequenceNote(key, columnPitches, clef) {
        if (columnPitches.length === 0) return new Flow.GhostNote({ duration: 'w' });
        const pitches = [...columnPitches].sort((lower, higher) => SequencePitch.diatonicStep(lower) - SequencePitch.diatonicStep(higher));
        const note = new Flow.StaveNote({ clef, keys: pitches.map(vexKey), duration: 'w' });
        pitches.forEach((pitch, index) => {
            if (pitch.alteration !== SequenceTheory.signatureAlteration(key, pitch.letter)) {
                note.addModifier(new Flow.Accidental(ACCIDENTAL_GLYPHS[pitch.alteration]), index);
            }
        });
        return note;
    }

    // Draws `columns` one after another on a grand staff in `key`: what was
    // played, in order. Each column is a list of pitches played together —
    // stacked as a chord. There is no metre and no rhythm, since no timing is
    // recorded: every note is a plain notehead, and a note shows its
    // accidental whenever it differs from the key signature. Each note goes on
    // the staff its spelling belongs to, and the other staff waits.
    function drawSequence(container, key, columns) {
        container.innerHTML = '';
        if (columns.length === 0) return;
        const available = Math.max(1, container.clientWidth);
        const layoutWidth = Math.max(available, LAYOUT_MIN_WIDTH);
        const usable = layoutWidth - 2 * MARGIN;
        const opening = openingWidth(key, null, false);
        const perLine = Math.max(6, Math.floor((usable - opening) / SEQUENCE_NOTE_WIDTH));
        const lines = [];
        for (let start = 0; start < columns.length; start += perLine) lines.push(columns.slice(start, start + perLine));
        const layoutHeight = lines.length * SYSTEM_HEIGHT;

        const renderer = new Flow.Renderer(container, Flow.Renderer.Backends.SVG);
        renderer.resize(layoutWidth, layoutHeight);
        const context = renderer.getContext();
        const svg = container.querySelector('svg');
        svg.setAttribute('viewBox', '0 0 ' + layoutWidth + ' ' + layoutHeight);
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'The passage notes played, in the order played');

        lines.forEach((line, lineIndex) => {
            const top = lineIndex * SYSTEM_HEIGHT + 20;
            const width = lineIndex === lines.length - 1
                ? Math.min(usable, opening + line.length * SEQUENCE_NOTE_WIDTH + BAR_PADDING) : usable;
            const { treble, bass } = staves(key, null, MARGIN, top, width, true, false);
            treble.setContext(context).draw();
            bass.setContext(context).draw();
            new Flow.StaveConnector(treble, bass).setType('brace').setContext(context).draw();
            new Flow.StaveConnector(treble, bass).setType('singleLeft').setContext(context).draw();
            new Flow.StaveConnector(treble, bass).setType('singleRight').setContext(context).draw();

            const onTreble = pitch => SequencePitch.diatonicStep(pitch) >= TREBLE_LOWEST_STEP;
            const upper = line.map(column => sequenceNote(key, column.filter(onTreble), 'treble'));
            const lower = line.map(column => sequenceNote(key, column.filter(pitch => !onTreble(pitch)), 'bass'));
            const timing = { num_beats: line.length * 4, beat_value: 4 };
            const voices = [new Flow.Voice(timing).addTickables(upper), new Flow.Voice(timing).addTickables(lower)];
            new Flow.Formatter().joinVoices([voices[0]]).joinVoices([voices[1]])
                .format(voices, treble.getNoteEndX() - treble.getNoteStartX() - 10);
            voices[0].draw(context, treble);
            voices[1].draw(context, bass);
        });
    }

    return { draw, drawSequence };
})();
