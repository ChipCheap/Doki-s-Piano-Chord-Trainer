// ═══════════════════════════════════════════════
//  STORAGE — shared by every page
// ═══════════════════════════════════════════════

// Every localStorage touch goes through these. Where storage is blocked (some
// file:// contexts, strict privacy modes) the raw calls throw, and an
// unguarded throw at load time would abort the rest of whichever script made
// the call — taking every listener it registers further down with it.
function readStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStored(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}
