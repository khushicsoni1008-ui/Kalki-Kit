// ==========================================================================
// KALKI-KIT SAVED CHECKS
// Keeps the user's past fact-checks in this browser (localStorage). Nothing
// is sent anywhere. Only real results are stored: no sample or demo records.
// ==========================================================================

(function () {
    const STORAGE_KEY = 'kalki_claims_repo';
    const MAX_RECORDS = 200;

    // Things earlier versions kept in this browser that no longer exist, including a saved API key
    const OBSOLETE_KEYS = [
        'gemini_api_key', 'gemini_model', 'kalki_auto_scan', 'kalki_strict_mode',
        'kalki_sources_repo', 'kalki_social_posts', 'kalki_heatmap_spots', 'kalki_audit_logs', 'kalki_notifications'
    ];

    // Demo records that older versions pre-loaded into every browser
    const isSampleRecord = c => /^REC-908[1-5]$/.test(c && c.id) && c.analysisMode === 'LOCAL_ENGINE';

    function readStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed.filter(c => c && typeof c === 'object' && !isSampleRecord(c)) : [];
        } catch (e) {
            return [];
        }
    }

    function writeStore(claims) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
        } catch (e) {
            // Storage full or blocked: keep working in memory for this visit
            console.warn('Could not save history:', e.message);
        }
    }

    const KalkiData = {
        claims: [],

        init() {
            try { OBSOLETE_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage unavailable */ }
            this.claims = readStore();
            writeStore(this.claims);
        },

        getClaims() {
            return this.claims;
        },

        newId() {
            let id;
            do { id = 'CHK-' + Math.floor(10000 + Math.random() * 90000); } while (this.claims.some(c => c.id === id));
            return id;
        },

        addClaim(claim) {
            if (!claim.id) claim.id = this.newId();
            if (!claim.timestamp) claim.timestamp = Date.now();

            // Checking the same claim again replaces the older entry instead of piling up duplicates
            const sameText = c => c.title && claim.title && c.title.toLowerCase().trim() === claim.title.toLowerCase().trim();
            this.claims = this.claims.filter(c => c.id !== claim.id && !sameText(c));
            this.claims.unshift(claim);
            if (this.claims.length > MAX_RECORDS) this.claims.length = MAX_RECORDS;
            writeStore(this.claims);

            window.dispatchEvent(new CustomEvent('kalki_claim_added', { detail: claim }));
            return claim;
        },

        deleteClaim(id) {
            this.claims = this.claims.filter(c => c.id !== id);
            writeStore(this.claims);
        },

        clearAllClaims() {
            this.claims = [];
            writeStore(this.claims);
        }
    };

    KalkiData.init();
    window.KalkiData = KalkiData;
})();
