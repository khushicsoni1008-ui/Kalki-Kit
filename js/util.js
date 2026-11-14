// ==========================================================================
// KALKI-KIT SHARED HELPERS
// Everything that ends up in innerHTML goes through esc() / safeUrl() first,
// so text from the web or from saved history can never inject markup.
// ==========================================================================

window.esc = function (value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Only plain http(s) links are ever clickable (blocks javascript: and data: URLs)
window.safeUrl = function (url) {
    try {
        const u = new URL(String(url || ''));
        return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (e) {
        return '';
    }
};

// The backend lives on the same origin; when the page is opened from another local dev server, point at port 3000
window.getBackendBase = window.getBackendBase || function () {
    return (window.location.protocol.startsWith('http') && window.location.port === '3000') ? '' : 'http://localhost:3000';
};

window.formatTimeAgo = function (ts) {
    if (!ts) return '';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// One place that decides how each verdict looks and reads
window.VERDICTS = {
    'TRUE': { key: 'true', label: 'Accurate', icon: 'fa-circle-check', meaning: 'The evidence we found supports this claim.' },
    'FALSE': { key: 'false', label: 'False', icon: 'fa-circle-xmark', meaning: 'The evidence we found contradicts this claim.' },
    'PARTIALLY TRUE': { key: 'partial', label: 'Partly true', icon: 'fa-circle-half-stroke', meaning: 'Some of this claim is right, but part of it is wrong or inaccurate.' },
    'MISLEADING': { key: 'misleading', label: 'Misleading', icon: 'fa-triangle-exclamation', meaning: 'The facts may be real, but the claim leaves out context that changes the meaning.' },
    'UNVERIFIED': { key: 'unverified', label: "Can't verify", icon: 'fa-circle-question', meaning: "We couldn't find enough reliable evidence either way. This does not mean the claim is false." },
    'AMBIGUOUS': { key: 'ambiguous', label: 'Unclear claim', icon: 'fa-comment-dots', meaning: 'This is too vague, or an opinion, so it cannot be checked as a fact.' },

    // Image checks describe the picture, not a claim, so they have their own wording
    'LIKELY AI-GENERATED': { key: 'ai', label: 'Likely AI-generated', icon: 'fa-robot', meaning: 'Visible clues suggest an AI tool made this image. That alone does not make the story around it false, or true.' },
    'SIGNS OF EDITING': { key: 'edited', label: 'Signs of editing', icon: 'fa-scissors', meaning: 'Visible clues suggest this image was changed after it was taken.' },
    'NO SIGNS FOUND': { key: 'clean', label: 'No obvious signs of manipulation', icon: 'fa-eye', meaning: "We didn't notice anything suspicious. This does not prove the image is real, or that it shows what is claimed." },
    'IMAGE UNCLEAR': { key: 'unverified', label: "Can't tell", icon: 'fa-circle-question', meaning: "The image doesn't give enough visible clues to judge." }
};

window.getVerdict = function (status) {
    const s = String(status || '').toUpperCase().trim();
    if (window.VERDICTS[s]) return window.VERDICTS[s];
    // Records saved by older versions may use other words
    if (s.includes('FALSE') || s.includes('FAKE') || s.includes('DISINFO')) return window.VERDICTS['FALSE'];
    if (s.includes('PARTIAL')) return window.VERDICTS['PARTIALLY TRUE'];
    if (s.includes('MISLEAD')) return window.VERDICTS['MISLEADING'];
    if (s.includes('TRUE')) return window.VERDICTS['TRUE'];
    if (s.includes('AMBIG')) return window.VERDICTS['AMBIGUOUS'];
    return window.VERDICTS['UNVERIFIED'];
};
