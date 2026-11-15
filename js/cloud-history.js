// ==========================================================================
// KALKI-KIT CLOUD HISTORY
// Authenticated users sync checks to users/{uid}/checks/{checkId}.
// Guest history remains local. Image thumbnails and uploaded image bytes
// are intentionally excluded from cloud records.
// ==========================================================================
(function () {
    const MAX_RECORDS = 200;
    let db = null;
    let checksRef = null;
    let unsubscribe = null;
    let applyingRemote = false;

    function toast(message, type = 'warning') {
        if (typeof window.showKalkiToast === 'function') {
            window.showKalkiToast('Cloud history', message, type);
        } else {
            console.warn('[KalkI cloud history]', message);
        }
    }

    function safeRecord(record, uid) {
        const copy = JSON.parse(JSON.stringify(record, (key, value) => {
            if (['thumb', 'imageBase64', 'previewUrl', 'fileData'].includes(key)) return undefined;
            if (typeof value === 'string' && /^data:image\\//i.test(value)) return undefined;
            return value;
        }));
        copy.uid = uid;
        copy.id = String(record.id);
        if (JSON.stringify(copy).length > 700000) {
            throw new Error('This check is too large to save. Its result will remain in this browser.');
        }
        return copy;
    }

    async function saveRecord(record) {
        if (!checksRef || applyingRemote || !record || !record.id) return;
        try {
            await checksRef.doc(String(record.id)).set(safeRecord(record, window.kalkiAuth.currentUser.uid), { merge: true });
        } catch (error) {
            console.error('[KALKI] Could not sync check:', error);
            toast('Could not sync a check. It is still saved in this browser.');
        }
    }

    async function deleteRecords(ids) {
        if (!checksRef || !Array.isArray(ids) || !ids.length) return;
        try {
            const batch = db.batch();
            ids.forEach(id => batch.delete(checksRef.doc(String(id))));
            await batch.commit();
        } catch (error) {
            console.error('[KALKI] Could not delete cloud checks:', error);
            toast('Could not delete one or more cloud copies. Please retry when online.');
        }
    }

    async function start() {
        if (!window.kalkiAuthReady) return;
        const user = await window.kalkiAuthReady;

        if (!user) {
            window.KalkiData.setScope('guest');
            return;
        }

        // Keep each account's local fallback separate from guest and other-user history.
        window.KalkiData.setScope('user_' + user.uid);

        if (!window.firebase || typeof window.firebase.firestore !== 'function') {
            toast('Cloud database is not available. Checks will stay in this browser.');
            return;
        }

        try {
            db = window.firebase.firestore();
            checksRef = db.collection('users').doc(user.uid).collection('checks');

            // Register changes before the first read so a check made during startup is not missed.
            window.addEventListener('kalki_claim_added', event => saveRecord(event.detail));
            window.addEventListener('kalki_claims_deleted', event => deleteRecords(event.detail));

            const snapshot = await checksRef.orderBy('timestamp', 'desc').limit(MAX_RECORDS).get();
            const cloudRecords = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            const localRecords = window.KalkiData.getClaims();
            const merged = new Map();
            cloudRecords.forEach(record => merged.set(record.id, record));
            localRecords.forEach(record => {
                const current = merged.get(record.id);
                if (!current || (record.timestamp || 0) > (current.timestamp || 0)) merged.set(record.id, record);
            });

            const mergedRecords = [...merged.values()]
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, MAX_RECORDS);
            window.KalkiData.setClaims(mergedRecords);

            // Restore locally cached authenticated records after an offline visit.
            if (localRecords.length) {
                const batch = db.batch();
                localRecords.slice(0, MAX_RECORDS).forEach(record => {
                    batch.set(checksRef.doc(String(record.id)), safeRecord(record, user.uid), { merge: true });
                });
                await batch.commit();
            }

            unsubscribe = checksRef.orderBy('timestamp', 'desc').limit(MAX_RECORDS).onSnapshot(remote => {
                const records = remote.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                applyingRemote = true;
                window.KalkiData.setClaims(records);
                applyingRemote = false;
            }, error => {
                applyingRemote = false;
                console.error('[KALKI] Cloud history listener failed:', error);
                toast('Could not refresh cloud history. Your local cache is still available.');
            });

            window.addEventListener('beforeunload', () => { if (unsubscribe) unsubscribe(); });
            window.addEventListener('kalki_history_reloaded', () => {
                if (window.location.hash === '#history' && typeof window.loadKalkiModule === 'function') {
                    window.loadKalkiModule('history', { updateHash: false });
                }
            });
        } catch (error) {
            console.error('[KALKI] Cloud history setup failed:', error);
            toast('Cloud history could not connect. Checks will remain saved in this browser.');
        }
    }

    start();
})();
