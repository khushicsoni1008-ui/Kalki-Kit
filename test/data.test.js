'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

function loadData(initialStorage = {}) {
    const values = new Map(Object.entries(initialStorage));
    const events = [];
    const localStorage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const window = { dispatchEvent(event) { events.push(event); } };
    class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }
    vm.runInNewContext(source, { window, localStorage, CustomEvent });
    return { data: window.KalkiData, values, events };
}

test('history storage is scoped to the signed-in Firebase UID', () => {
    const accountRecord = { id: 'A-1', title: 'Account check' };
    const guestRecord = { id: 'G-1', title: 'Guest check' };
    const otherRecord = { id: 'B-1', title: 'Other account check' };
    const { data } = loadData({
        kalki_user_session: JSON.stringify({ mode: 'firebase', uid: 'user-a' }),
        'kalki_claims_repo_user_user-a': JSON.stringify([accountRecord]),
        kalki_claims_repo: JSON.stringify([guestRecord]),
        'kalki_claims_repo_user_user-b': JSON.stringify([otherRecord])
    });

    assert.deepEqual(JSON.parse(JSON.stringify(data.getClaims())), [accountRecord]);
    data.setScope('guest');
    assert.deepEqual(JSON.parse(JSON.stringify(data.getClaims())), [guestRecord]);
    data.setScope('user_user-b');
    assert.deepEqual(JSON.parse(JSON.stringify(data.getClaims())), [otherRecord]);
});

test('add, replace, delete and clear emit cloud-sync events', () => {
    const { data, events } = loadData();
    data.addClaim({ id: 'CHK-1', title: 'Same claim', timestamp: 1 });
    data.addClaim({ id: 'CHK-2', title: 'same claim', timestamp: 2 });

    assert.equal(data.getClaims().length, 1);
    assert.equal(data.getClaims()[0].id, 'CHK-2');
    assert.ok(events.some(event => event.type === 'kalki_claim_added' && event.detail.id === 'CHK-2'));
    assert.ok(events.some(event => event.type === 'kalki_claims_deleted' && event.detail.includes('CHK-1')));

    data.deleteClaim('CHK-2');
    assert.equal(data.getClaims().length, 0);
    assert.ok(events.some(event => event.type === 'kalki_claims_deleted' && event.detail.includes('CHK-2')));

    data.addClaim({ id: 'CHK-3', title: 'Another claim' });
    data.clearAllClaims();
    assert.equal(data.getClaims().length, 0);
    assert.ok(events.some(event => event.type === 'kalki_claims_deleted' && event.detail.includes('CHK-3')));
});
