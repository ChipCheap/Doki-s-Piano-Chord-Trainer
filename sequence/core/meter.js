// ═══════════════════════════════════════════════
//  SEQUENCE MODE — METER (core: pure, no page access)
// ═══════════════════════════════════════════════

// The one place meter is defined. Rhythm, the left-hand patterns and the
// notation's beaming all read it, so adding a time signature means adding it
// here and nowhere else. Positions and durations count in eighths, from 0 at
// the start of the bar.
const SequenceMeter = (() => {
    const DURATIONS = { eighth: 1, quarter: 2, dottedQuarter: 3, half: 4, dottedHalf: 6 };

    // strongPositions are the beats that take a chord tone in the melody.
    // Eighths beam in pairs within each quarter beat.
    const TIME_SIGNATURES = {
        '4/4': { beats: 4, beatValue: 4, barLength: 8, beatLength: 2, strongPositions: [0, 4] },
        '3/4': { beats: 3, beatValue: 4, barLength: 6, beatLength: 2, strongPositions: [0] },
    };

    function meter(timeSignature) {
        return TIME_SIGNATURES[timeSignature];
    }

    function isStrong(timeSignature, position) {
        return meter(timeSignature).strongPositions.includes(position);
    }

    // Notes in the same beam group may be beamed together.
    function beamGroup(timeSignature, position) {
        return Math.floor(position / meter(timeSignature).beatLength);
    }

    // A note this long or longer is "long": it carries the weight of a beat,
    // so it obeys the same restrictions as a note on a strong beat.
    const LONG_NOTE = DURATIONS.quarter;

    return { DURATIONS, TIME_SIGNATURES, LONG_NOTE, meter, isStrong, beamGroup };
})();
