// ═══════════════════════════════════════════════
//  SEQUENCE MODE — NOTATION ADAPTER (shell)
// ═══════════════════════════════════════════════

// The only file that talks to VexFlow. It draws a passage as a grand staff and
// can mark individual notes for the review. What to draw — spellings, which
// accidentals show, how eighths group — comes from the core; VexFlow only
// engraves it. Its own automatic accidentals are never used.
const SequenceNotation = (() => {
    const Flow = Vex.Flow;

    // One system of four bars from this width up; two systems of two below it.
    const ONE_SYSTEM_FROM = 760;
    // Drawing coordinates are laid out at least this wide and then scaled to
    // the container, so a phone gets a smaller passage rather than a cramped or
    // scrolling one.
    const LAYOUT_MIN_WIDTH = 620;
    const SYSTEM_HEIGHT = 230;
    const STAFF_GAP = 105;
    const MARGIN = 12;
    // The first bar of a system also carries clefs, key and time signatures.
    const OPENING_EXTRA = { withSignature: 120, withoutSignature: 70 };

    // Dotted values carry the dot in the duration, which is what gives them
    // their length; the drawn dot is attached separately.
    const VEX_DURATIONS = { 1: '8', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd' };
    const DOTTED = new Set([3, 6]);
    const ACCIDENTAL_GLYPHS = { '-2': 'bb', '-1': 'b', '0': 'n', '1': '#', '2': '##' };
    // A rest sits in the middle of its staff.
    const REST_KEYS = { right: 'b/4', left: 'd/3' };

    // The review's two marks, colour and symbol together so colour is never
    // the only signal. Colours match the chord trainer's keyboard.
    const MARK_STYLES = {
        cameUp: { colour: '#1a3a8b', symbol: '' },
        missed: { colour: '#8b1a1a', symbol: '✗' },
    };

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
            const symbols = event.pitches.map(pitch => marks && marks.get(pitch))
                .filter(mark => mark && MARK_STYLES[mark].symbol).map(mark => MARK_STYLES[mark].symbol);
            if (symbols.length) {
                const annotation = new Flow.Annotation(symbols[0]).setVerticalJustification(Flow.Annotation.VerticalJustify.TOP);
                annotation.setStyle({ fillStyle: MARK_STYLES.missed.colour });
                note.addModifier(annotation, 0);
            }
            return note;
        });
    }

    // Draws `passage` into `container`, replacing whatever was there.
    // `marks`, optional, maps passage pitch objects to 'cameUp' or 'missed'.
    function draw(container, passage, marks) {
        container.innerHTML = '';
        const available = Math.max(1, container.clientWidth);
        const barsPerSystem = available >= ONE_SYSTEM_FROM ? 4 : 2;
        const layoutWidth = Math.max(available, LAYOUT_MIN_WIDTH);
        const systems = passage.bars.length / barsPerSystem;
        const layoutHeight = systems * SYSTEM_HEIGHT;

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

        const meter = SequenceMeter.meter(passage.timeSignature);
        const beamGroups = [new Flow.Fraction(meter.beatLength, 8)];
        const usable = layoutWidth - 2 * MARGIN;

        for (let system = 0; system < systems; system++) {
            const top = system * SYSTEM_HEIGHT + 20;
            const opening = system === 0 ? OPENING_EXTRA.withSignature : OPENING_EXTRA.withoutSignature;
            const barWidth = (usable - opening) / barsPerSystem;
            let x = MARGIN;

            for (let column = 0; column < barsPerSystem; column++) {
                const barIndex = system * barsPerSystem + column;
                const bar = passage.bars[barIndex];
                const width = barWidth + (column === 0 ? opening : 0);
                const treble = new Flow.Stave(x, top, width);
                const bass = new Flow.Stave(x, top + STAFF_GAP, width);
                if (column === 0) {
                    treble.addClef('treble').addKeySignature(signatureName(passage.key));
                    bass.addClef('bass').addKeySignature(signatureName(passage.key));
                    if (system === 0) {
                        treble.addTimeSignature(meter.beats + '/' + meter.beatValue);
                        bass.addTimeSignature(meter.beats + '/' + meter.beatValue);
                    }
                }
                if (barIndex === passage.bars.length - 1) {
                    treble.setEndBarType(Flow.Barline.type.END);
                    bass.setEndBarType(Flow.Barline.type.END);
                }
                // Both staves start their notes at the same x, so the hands line up
                // even though a treble and a bass clef differ in width.
                const noteStart = Math.max(treble.getNoteStartX(), bass.getNoteStartX());
                treble.setNoteStartX(noteStart);
                bass.setNoteStartX(noteStart);
                treble.setContext(context).draw();
                bass.setContext(context).draw();

                if (column === 0) {
                    new Flow.StaveConnector(treble, bass).setType('brace').setContext(context).draw();
                    new Flow.StaveConnector(treble, bass).setType('singleLeft').setContext(context).draw();
                }
                const rightEnd = barIndex === passage.bars.length - 1 ? 'boldDoubleRight' : 'singleRight';
                new Flow.StaveConnector(treble, bass).setType(rightEnd).setContext(context).draw();

                const rightNotes = staffNotes(passage, bar.right, 'right', marks);
                const leftNotes = staffNotes(passage, bar.left, 'left', marks);
                const timing = { num_beats: meter.beats, beat_value: meter.beatValue };
                const rightVoice = new Flow.Voice(timing).addTickables(rightNotes);
                const leftVoice = new Flow.Voice(timing).addTickables(leftNotes);
                const beams = [
                    ...Flow.Beam.generateBeams(rightNotes, { groups: beamGroups }),
                    ...Flow.Beam.generateBeams(leftNotes, { groups: beamGroups }),
                ];
                new Flow.Formatter().joinVoices([rightVoice]).joinVoices([leftVoice])
                    .format([rightVoice, leftVoice], treble.getNoteEndX() - treble.getNoteStartX() - 10);
                rightVoice.draw(context, treble);
                leftVoice.draw(context, bass);
                beams.forEach(beam => beam.setContext(context).draw());
                x += width;
            }
        }
    }

    return { draw };
})();
