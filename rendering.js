// ═══════════════════════════════════════════════
//  RENDERING — Staff, Piano, Clefs
// ═══════════════════════════════════════════════

// Staff position reference: bottom line of treble staff = E4
// E4_MIDI is the absolute diatonic step used as the vertical anchor.
const E4_MIDI = 30;

function staffYFromNoteName(note, staffTop, lineSpacing) {
    const step = note.octave * 7 + BASE_NOTES.indexOf(note.name);
    const halfSpace = lineSpacing / 2;
    return staffTop + (4 * lineSpacing) - (step - E4_MIDI) * halfSpace;
}

// Diatonic step from a raw MIDI number — used for 2nd-collision detection.
const DIATONIC = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
function midiToDiatonicStep(midi) {
    const octave = Math.floor(midi / 12) - 1;
    return octave * 7 + DIATONIC[midi % 12];
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

    drawNotesForStaff(ctx, trebleNotes, trebleTop, trebleTop, staffLeft, lineSpacing, noteRadius);
    drawNotesForStaff(ctx, bassNotes,   bassTop,   trebleTop, staffLeft, lineSpacing, noteRadius);

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

function drawNotesForStaff(ctx, staffNotes, staffTop, trebleTop, staffLeft, lineSpacing, noteRadius) {
    if (staffNotes.length === 0) return;
    const n = staffNotes.length;

    // X offsets for 2nd collisions
    const noteOffset = noteRadius * 2.2;
    const xShifts = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) {
        if (Math.abs(BASE_NOTES.indexOf(staffNotes[i].name) - BASE_NOTES.indexOf(staffNotes[i + 1].name)) === 1) {
            xShifts[i + 1] = xShifts[i] + noteOffset;
        }
    }

    // Accidental X offsets
    const accXShifts = new Array(n).fill(0);
    const accidentalWidth = lineSpacing;
    for (let i = 0; i < n; i++) {
        if (!staffNotes[i].augment) continue;
        let runEnd = i;
        while (
            runEnd + 1 < n &&
            staffNotes[runEnd + 1].augment &&
            Math.abs(midiToDiatonicStep(staffNotes[runEnd + 1].midi) - midiToDiatonicStep(staffNotes[runEnd].midi)) === 1
        ) { runEnd++; }
        const runLen = runEnd - i + 1;
        if (runLen === 2)     accXShifts[i] = -accidentalWidth;
        else if (runLen >= 3) accXShifts[i + Math.floor((runLen - 1) / 2)] = -accidentalWidth;
        i = runEnd;
    }
    for (let i = 0; i < n; i++) {
        if (staffNotes[i].augment && xShifts[i] > 0) accXShifts[i] -= xShifts[i];
    }

    const noteXBase = staffLeft + clefShift + 50;

    staffNotes.forEach((note, idx) => {
        const noteX = noteXBase + xShifts[idx];
        const y = staffYFromNoteName(note, trebleTop, lineSpacing);

        drawLedgerLines(ctx, note.midi, noteX, staffTop, lineSpacing, noteRadius, y);

        if (note.augment && imagesReady) {
            const imgMap = {'#': sharpImg, 'b': flatImg, 'x': doubleSharpImg, 'V': doubleFlatImg};
            const img = imgMap[note.augment];
            if (img && img.naturalWidth > 0) {
                const imgH = lineSpacing * 2.0;
                const imgW = imgH * (img.naturalWidth / img.naturalHeight);
                const accX = noteX + accXShifts[idx] - noteRadius - 2;
                ctx.drawImage(img, accX - imgW, y - imgH * 2 / 3, imgW, imgH);
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

function drawLedgerLines(ctx, midi, noteX, staffTop, lineSpacing, noteRadius, y) {
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 1.5;
    const halfSpace = lineSpacing / 2;
    const bottomLineY = staffTop + 4 * lineSpacing;
    const topLineY = staffTop;

    if (y > bottomLineY + halfSpace) {
        let ly = bottomLineY + lineSpacing;
        while (ly <= y + halfSpace) {
            if (Math.abs(y - ly) < halfSpace + 1) {
                ctx.beginPath();
                ctx.moveTo(noteX - noteRadius * 1.8, ly);
                ctx.lineTo(noteX + noteRadius * 1.8, ly);
                ctx.stroke();
            }
            ly += lineSpacing;
        }
    }
    if (y < topLineY - halfSpace) {
        let ly = topLineY - lineSpacing;
        while (ly >= y - halfSpace) {
            if (Math.abs(y - ly) < halfSpace + 1) {
                ctx.beginPath();
                ctx.moveTo(noteX - noteRadius * 1.8, ly);
                ctx.lineTo(noteX + noteRadius * 1.8, ly);
                ctx.stroke();
            }
            ly -= lineSpacing;
        }
    }
}

// ── Piano drawing ─────────────────────────────
function drawPiano(canvas, notes, octave, heldMidi = new Set(), hideChord = false) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const startOctave = Math.max(0, octave - 1);
    const numOctaves  = 3;
    const whitePC  = [0, 2, 4, 5, 7, 9, 11];
    const blackPC  = [1, 3, 6, 8, 10];
    const blackOffset = {1: 0.67, 3: 1.67, 6: 3.67, 8: 4.67, 10: 5.67};
    const chordMidiSet = new Set(notes.map(n => n.midi));

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

    function keyColor(midi, isBlack) {
        if (heldMidi.has(midi))                       return '#1a3a8b'; // held → blue
        if (!hideChord && chordMidiSet.has(midi))     return '#8b1a1a'; // target → red
        return isBlack ? '#1a1410' : '#f8f3ea';
    }

    // White keys
    whites.forEach(({midi, index}) => {
        const x = margin + index * wKeyW;
        const isActive = heldMidi.has(midi) || (!hideChord && chordMidiSet.has(midi));
        ctx.beginPath();
        ctx.roundRect(x + 1, 10, wKeyW - 2, wKeyH, [0, 0, 3, 3]);
        ctx.fillStyle = keyColor(midi, false);
        ctx.fill();
        ctx.strokeStyle = '#c8a96e';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        if (isActive) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath();
            ctx.roundRect(x + 3, 12, wKeyW - 6, 20, 2);
            ctx.fill();
        }
        if (wKeyW > 16 && midi % 12 === 0) {
            ctx.fillStyle = isActive ? '#f5f0e8' : '#7a6040';
            ctx.font = `${Math.min(10, wKeyW * 0.55)}px 'Source Code Pro', monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('C' + (Math.floor(midi / 12) - 1), x + wKeyW / 2, 10 + wKeyH - 6);
        }
    });

    // Black keys
    for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
        const octStart = oct - startOctave;
        blackPC.forEach(pc => {
            const xPos = margin + (octStart * 7 + blackOffset[pc]) * wKeyW - bKeyOffset;
            const midi = (oct + 1) * 12 + pc;
            const isActive = heldMidi.has(midi) || (!hideChord && chordMidiSet.has(midi));
            ctx.beginPath();
            ctx.roundRect(xPos, 10, bKeyW, bKeyH, [0, 0, 3, 3]);
            ctx.fillStyle = keyColor(midi, true);
            ctx.fill();
            if (isActive) {
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath();
                ctx.roundRect(xPos + 2, 12, bKeyW - 4, 14, 2);
                ctx.fill();
            }
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
