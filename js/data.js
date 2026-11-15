// ==========================================================================
// KALKI-KIT SAVED CHECKS
// Signed-in users get a private local cache per Firebase UID; guest history
// remains in this browser. Authenticated history is synced by cloud-history.js.
// ==========================================================================
(function () {
    const LEGACY_STORAGE_KEY = 'kalki_claims_repo';
    const MAX_RECORDS = 200;
    const OBSOLETE_KEYS = [
        'gemini_api_key', 'gemini_model', 'kalki_auto_scan', 'kalki_strict_mode',
        'kalki_sources_repo', 'kalki_social_posts', 'kalki_heatmap_spots', 'kalki_audit_logs', 'kalki_notifications'
    ];
    const isSampleRecord = c => /^REC-908[1-5]$/.test(c && c.id) && c.analysisMode === 'LOCAL_ENGINE';

    function initialScope() {
        try {
            const session = JSON.parse(localStorage.getItem('kalki_user_session') || 'null');
            return session && session.mode === 'firebase' && session.uid ? 'user_' + session.uid : 'guest';
        } catch (e) { return 'guest'; }
    }

    let scope = initialScope();
    const storageKey = () => scope === 'guest' ? LEGACY_STORAGE_KEY : LEGACY_STORAGE_KEY + '_' + scope;

    function readStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]');
            return Array.isArray(parsed) ? parsed.filter(c => c && typeof c === 'object' && !isSampleRecord(c)) : [];
        } catch (e) { return []; }
    }

    function writeStore(claims) {
        try { localStorage.setItem(storageKey(), JSON.stringify(claims)); }
        catch (e) { console.warn('Could not save history:', e.message); }
    }

    const KalkiData = {
        claims: [],
        init() {
            try { OBSOLETE_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {}
            this.claims = readStore();
            writeStore(this.claims);
        },
        getClaims() { return this.claims; },
        setScope(nextScope) {
            if (!nextScope || nextScope === scope) return;
            scope = nextScope;
            this.claims = readStore();
            writeStore(this.claims);
            window.dispatchEvent(new CustomEvent('kalki_history_reloaded'));
        },
        setClaims(claims) {
            this.claims = (Array.isArray(claims) ? claims : [])
                .filter(c => c && typeof c === 'object' && !isSampleRecord(c))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, MAX_RECORDS);
            writeStore(this.claims);
            window.dispatchEvent(new CustomEvent('kalki_history_reloaded'));
        },
        newId() {
            let id;
            do { id = 'CHK-' + Math.floor(10000 + Math.random() * 90000); }
            while (this.claims.some(c => c.id === id));
            return id;
        },
        addClaim(claim) {
            if (!claim.id) claim.id = this.newId();
            if (!claim.timestamp) claim.timestamp = Date.now();
            const sameText = c => c.title && claim.title && c.title.toLowerCase().trim() === claim.title.toLowerCase().trim();
            const replaced = this.claims.filter(c => c.id !== claim.id && sameText(c)).map(c => c.id);
            this.claims = this.claims.filter(c => c.id !== claim.id && !sameText(c));
            this.claims.unshift(claim);
            const overflow = this.claims.slice(MAX_RECORDS).map(c => c.id);
            if (this.claims.length > MAX_RECORDS) this.claims.length = MAX_RECORDS;
            writeStore(this.claims);
            const removedIds = [...new Set([...replaced, ...overflow])];
            if (removedIds.length) window.dispatchEvent(new CustomEvent('kalki_claims_deleted', { detail: removedIds }));
            window.dispatchEvent(new CustomEvent('kalki_claim_added', { detail: claim }));
            return claim;
        },
        deleteClaim(id) {
            this.claims = this.claims.filter(c => c.id !== id);
            writeStore(this.claims);
            window.dispatchEvent(new CustomEvent('kalki_claims_deleted', { detail: [id] }));
        },
        clearAllClaims() {
            const ids = this.claims.map(c => c.id);
            this.claims = [];
            writeStore(this.claims);
            window.dispatchEvent(new CustomEvent('kalki_claims_deleted', { detail: ids }));
        }
    };

    KalkiData.init();
    window.KalkiData = KalkiData;
})();
