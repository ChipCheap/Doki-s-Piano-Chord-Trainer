// ═══════════════════════════════════════════════
//  RENDERING — Staff, Piano, Clefs
// ═══════════════════════════════════════════════

// Narrowest the staff canvas is ever drawn at. A deep accidental stack (up to
// four columns) plus the clef needs this much room before the noteheads would
// run past the barline. The canvas is CSS-scaled to fit its container, so a
// wider drawing surface costs nothing on small screens — it just renders
// smaller rather than clipping.
const STAFF_MIN_WIDTH = 470;

// Staff position reference: bottom line of treble staff = E4.
// E4_STEP is the diatonic step used as the vertical anchor (not a MIDI number).
const E4_STEP = 30;

function staffYFromNoteName(note, staffTop, lineSpacing) {
    const halfSpace = lineSpacing / 2;
    return staffTop + (4 * lineSpacing) - (diatonicStep(note) - E4_STEP) * halfSpace;
}

let clefShift = 0;

// ── Staff drawing ─────────────────────────────
function drawStaff(canvas, notes) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const staffLeft  = 130;
    const staffRight = W - 40;
    const lineSpacing = 18;
    const noteRadius  = 8;

    const trebleTop = H / 2 - 5 * lineSpacing;
    const bassTop   = trebleTop + 6 * lineSpacing;

    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1.5;
    [trebleTop, bassTop].forEach(top => {
        for (let i = 0; i < 5; i++) {
            const y = top + i * lineSpacing;
            ctx.beginPath();
            ctx.moveTo(staffLeft - 4, y);
            ctx.lineTo(staffRight, y);
            ctx.stroke();
        }
    });

    // Brace
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(staffLeft - 5, trebleTop);
    ctx.lineTo(staffLeft - 5, bassTop + 4 * lineSpacing);
    ctx.stroke();

    // Clefs
    clefShift = 0;
    drawClef(ctx, staffLeft, trebleTop, lineSpacing, trebleImg);
    drawClef(ctx, staffLeft, bassTop,   lineSpacing, bassImg);

    const trebleNotes = notes.filter(n => n.midi >= 60).sort((a, b) => a.midi - b.midi);
    const bassNotes   = notes.filter(n => n.midi <  60).sort((a, b) => a.midi - b.midi);

    // Accidentals are packed across both staves at once. The two staves share a
    // continuous vertical scale, so a note just below middle C and one just
    // above it are only a step apart on screen — packing each staff separately
    // let those two collide.
    const orderedNotes = [...trebleNotes, ...bassNotes];
    const orderedY = orderedNotes.map(n => staffYFromNoteName(n, trebleTop, lineSpacing));
    const acc = layoutAccidentals(orderedNotes, orderedY, lineSpacing);

    // Both staves share one notehead origin so the chord stays vertically
    // aligned. Adding exactly one column-width per column keeps the distance
    // between the clef and the leftmost accidental constant however deep the
    // stack gets.
    const accColumnWidth = acc.columnWidth * 1.05;
    const noteXBase = staffLeft + clefShift + 50 + acc.columnCount * accColumnWidth;

    // Notehead offsets are computed across both staves for the same reason as
    // the accidentals: a second can straddle the seam — B3 sits in the bass
    // group and C4 in the treble, and packing each staff alone meant those two
    // never met, so they were drawn on top of each other.
    const xShifts = layoutSecondOffsets(orderedNotes, noteRadius * 2.2);

    const split = trebleNotes.length;
    drawNotesForStaff(ctx, trebleNotes, trebleTop, orderedY.slice(0, split), noteXBase,
                      xShifts.slice(0, split), acc.columns.slice(0, split), accColumnWidth, lineSpacing, noteRadius);
    drawNotesForStaff(ctx, bassNotes, bassTop, orderedY.slice(split), noteXBase,
                      xShifts.slice(split), acc.columns.slice(split), accColumnWidth, lineSpacing, noteRadius);

    // Bar lines spanning both staves
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(staffRight, trebleTop);
    ctx.lineTo(staffRight, bassTop + 4 * lineSpacing);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(staffRight + 5, trebleTop);
    ctx.lineTo(staffRight + 5, bassTop + 4 * lineSpacing);
    ctx.stroke();
}

// ── Accidental layout ─────────────────────────
const ACCIDENTAL_IMAGES = {'#': 'sharp', 'b': 'flat', 'x': 'doubleSharp', 'V': 'doubleFlat'};

function accidentalSize(note, lineSpacing) {
    const key = ACCIDENTAL_IMAGES[note.augment];
    if (!key) return null;
    const img = {sharp: sharpImg, flat: flatImg, doubleSharp: doubleSharpImg, doubleFlat: doubleFlatImg}[key];
    if (!img || !img.naturalWidth) return null;
    const h = lineSpacing * 2.0;
    return { img, h, w: h * (img.naturalWidth / img.naturalHeight) };
}

// Accidentals stack in their own columns to the left of the chord. Working from
// the top down, each one takes the first column — nearest the noteheads —  where
// its glyph box does not vertically overlap an accidental already sitting there.
// This is the standard engraving rule. The heuristic it replaces only looked at
// runs of seconds and moved a single accidental per run, so stacked thirds (a
// diminished 7th, say) piled every glyph into one column.
function layoutAccidentals(staffNotes, ys, lineSpacing) {
    const columns = new Array(staffNotes.length).fill(-1);
    const occupied = [];            // per column: the boxes already placed
    let columnWidth = lineSpacing;  // floor, so a chord with no accidentals still has a sane width

    const topDown = staffNotes
        .map((note, i) => i)
        .filter(i => accidentalSize(staffNotes[i], lineSpacing))
        .sort((a, b) => ys[a] - ys[b]);

    for (const i of topDown) {
        const size = accidentalSize(staffNotes[i], lineSpacing);
        columnWidth = Math.max(columnWidth, size.w);
        // The glyph hangs two thirds above its note's line and one third below.
        const top = ys[i] - size.h * 2 / 3;
        const bottom = top + size.h;

        let c = 0;
        while (occupied[c] && occupied[c].some(b => top < b.bottom && b.top < bottom)) c++;
        (occupied[c] = occupied[c] || []).push({ top, bottom });
        columns[i] = c;
    }

    return { columns, columnCount: occupied.length, columnWidth };
}

// Notes a diatonic step apart cannot share a column. Comparing diatonic steps
// rather than BASE_NOTES indices is what makes B->C read as a second instead of
// a 6th, and within a run the offset alternates left/right/left — marching
// further right with each note drifts the whole cluster off its column.
function layoutSecondOffsets(notes, noteOffset) {
    const shifts = new Array(notes.length).fill(0);
    const byPitch = notes.map((n, i) => i)
        .sort((a, b) => diatonicStep(notes[a]) - diatonicStep(notes[b]));

    for (let i = 0; i < byPitch.length; i++) {
        let runEnd = i;
        while (runEnd + 1 < byPitch.length &&
               diatonicStep(notes[byPitch[runEnd + 1]]) - diatonicStep(notes[byPitch[runEnd]]) === 1) {
            runEnd++;
        }
        for (let j = i; j <= runEnd; j++) shifts[byPitch[j]] = ((j - i) % 2) * noteOffset;
        i = runEnd;
    }
    return shifts;
}

function drawNotesForStaff(ctx, staffNotes, staffTop, ys, noteXBase, xShifts, accColumns, accColumnWidth, lineSpacing, noteRadius) {
    if (staffNotes.length === 0) return;

    staffNotes.forEach((note, idx) => {
        const noteX = noteXBase + xShifts[idx];
        const y = ys[idx];

        drawLedgerLines(ctx, noteX, staffTop, lineSpacing, noteRadius, y);

        // Accidentals hang off noteXBase, not noteX: they form columns to the
        // left of the chord as a whole and must not follow a notehead that was
        // pushed right to resolve a second.
        const col = accColumns[idx];
        if (col >= 0) {
            const size = accidentalSize(note, lineSpacing);
            if (size) {
                const right = noteXBase - noteRadius - 2 - col * accColumnWidth;
                ctx.drawImage(size.img, right - size.w, y - size.h * 2 / 3, size.w, size.h);
            }
        }

        ctx.save();
        ctx.translate(noteX, y);
        ctx.scale(1.25, 1);
        ctx.beginPath();
        ctx.arc(0, 0, noteRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1410';
        ctx.fill();
        ctx.restore();
    });
}

function drawLedgerLines(ctx, noteX, staffTop, lineSpacing, noteRadius, y) {
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 1.5;
    const eps = 0.5;

    const draw = ly => {
        ctx.beginPath();
        ctx.moveTo(noteX - noteRadius * 1.8, ly);
        ctx.lineTo(noteX + noteRadius * 1.8, ly);
        ctx.stroke();
    };

    // Every ledger position from just outside the staff up to the note. A note
    // sitting on a line gets its own line; one in a space stops at the last
    // line before it. Skipping the intermediate lines leaves a note floating
    // with no way to count its position.
    for (let ly = staffTop + 5 * lineSpacing; ly <= y + eps; ly += lineSpacing) draw(ly);
    for (let ly = staffTop - lineSpacing;     ly >= y - eps; ly -= lineSpacing) draw(ly);
}

// ── Piano drawing ─────────────────────────────
// heldMidi = notes currently played. expandTo = extra MIDI numbers the window
// must cover; the live keyboard passes none, because rescaling mid-performance
// destroys the spatial reference you play by. The results view passes the held
// notes, so a stray note well outside the chord is still visible on review.
function drawPiano(canvas, notes, heldMidi = new Set(), hideChord = false, expandTo = null) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const whitePC  = [0, 2, 4, 5, 7, 9, 11];
    const blackPC  = [1, 3, 6, 8, 10];
    const blackOffset = {1: 0.67, 3: 1.67, 6: 3.67, 8: 4.67, 10: 5.67};
    const chordMidiSet = new Set(notes.map(n => n.midi));

    // Anchor the window on the chord itself. The octave dropdown only names the
    // root, and a wide voicing reaches well past it.
    const spread = notes.map(n => n.midi);
    if (expandTo) for (const m of expandTo) spread.push(m);
    const lowest  = spread.length ? Math.min(...spread) : 60;
    const highest = spread.length ? Math.max(...spread) : 60;

    const startOctave = Math.max(0, Math.floor(lowest / 12) - 1);
    // Three octaves cover any single chord (the widest spans 21 semitones);
    // only stray played notes passed via expandTo can force it wider.
    const numOctaves = Math.min(5, Math.max(3,
        Math.ceil((highest - (startOctave + 1) * 12) / 12)));

    const whites = [];
    let totalWhites = 0;
    for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
        whitePC.forEach(pc => whites.push({midi: (oct + 1) * 12 + pc, index: totalWhites++}));
    }
    whites.push({midi: (startOctave + numOctaves + 1) * 12, index: totalWhites++});

    const margin   = 20;
    const wKeyW    = (W - margin * 2) / totalWhites;
    const wKeyH    = H - 20;
    const bKeyW    = wKeyW * 0.6;
    const bKeyH    = wKeyH * 0.6;
    const bKeyOffset = (wKeyW - bKeyW) / 2;

    // Three states, resolved explicitly: a held target note is 'correct' and
    // must not fall through to a plain 'held' colour, which is what made a
    // right answer and a wrong extra note look identical.
    // While the target is hidden, 'wrong' is suppressed — telling you a note is
    // wrong would give the answer away.
    function keyState(midi) {
        const held   = heldMidi.has(midi);
        const target = chordMidiSet.has(midi);
        if (hideChord)      return held ? 'correct' : 'idle';
        if (held && target) return 'correct';
        if (target)         return 'missed';
        if (held)           return 'wrong';
        return 'idle';
    }

    const STATE_FILL = {correct: '#1a3a8b', missed: '#8b1a1a', wrong: '#8a6d1f'};

    function paintKey(midi, x, y, w, h, isBlack) {
        const state = keyState(midi);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, [0, 0, 3, 3]);
        ctx.fillStyle = STATE_FILL[state] || (isBlack ? '#1a1410' : '#f8f3ea');
        ctx.fill();
        // Shape as well as hue, so the three states stay separable without
        // relying on colour: held keys carry a highlight bar, and a wrong one
        // additionally gets a dark ring.
        if (state === 'wrong') {
            ctx.strokeStyle = '#4a3a08';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (!isBlack) {
            ctx.strokeStyle = '#c8a96e';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
        if (state === 'correct' || state === 'wrong') {
            ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.25)';
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, w - 4, isBlack ? 14 : 20, 2);
            ctx.fill();
        }
        return state;
    }

    whites.forEach(({midi, index}) => {
        const x = margin + index * wKeyW;
        const state = paintKey(midi, x + 1, 10, wKeyW - 2, wKeyH, false);
        if (wKeyW > 16 && midi % 12 === 0) {
            ctx.fillStyle = state === 'idle' ? '#7a6040' : '#f5f0e8';
            ctx.font = `${Math.min(10, wKeyW * 0.55)}px 'Source Code Pro', monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('C' + (Math.floor(midi / 12) - 1), x + wKeyW / 2, 10 + wKeyH - 6);
        }
    });

    for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
        const octStart = oct - startOctave;
        blackPC.forEach(pc => {
            const xPos = margin + (octStart * 7 + blackOffset[pc]) * wKeyW - bKeyOffset;
            paintKey((oct + 1) * 12 + pc, xPos, 10, bKeyW, bKeyH, true);
        });
    }
}

// ── Image loading ──────────────────────────────
const trebleImg      = new Image();
const bassImg        = new Image();
const doubleSharpImg = new Image();
const doubleFlatImg  = new Image();
const sharpImg       = new Image();
const flatImg        = new Image();
let imagesReady = false;

function loadClefImages() {
    const imgs = [trebleImg, bassImg, doubleSharpImg, doubleFlatImg, sharpImg, flatImg];
    return new Promise(resolve => {
        let loaded = 0;
        function onLoad() { if (++loaded === imgs.length) { imagesReady = true; resolve(); } }
        imgs.forEach(img => { img.onload = onLoad; img.onerror = onLoad; });
        trebleImg.src      = 'Trebleclef.png';
        bassImg.src        = 'Bassclef.png';
        doubleSharpImg.src = 'Doublesharp.png';
        doubleFlatImg.src  = 'Doubleb.png';
        sharpImg.src       = 'Sharp.png';
        flatImg.src        = 'B.png';
    });
}

function drawClef(ctx, x, staffTop, lineSpacing, image) {
    if (!imagesReady || !image.complete || image.naturalWidth === 0) return;
    const staffHeight = 4 * lineSpacing;
    const imgH = staffHeight * 2;
    const imgW = imgH * (image.naturalWidth / image.naturalHeight);
    ctx.drawImage(image, x, staffTop - lineSpacing * 2, imgW, imgH);
    clefShift = Math.max(clefShift, imgW);
}
