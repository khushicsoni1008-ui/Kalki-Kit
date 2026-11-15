'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

let server;
let baseUrl;

before(async () => {
    server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

test('health endpoint responds with status and configuration flag', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.geminiConfigured, 'boolean');
});

test('main dashboard is served by Express', async () => {
    const response = await fetch(`${baseUrl}/index.html`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.match(await response.text(), /Kalki/i);
});

test('protected verification endpoint rejects requests without authentication', async () => {
    const response = await fetch(`${baseUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: 'The Earth revolves around the Sun.' })
    });

    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /login/i);
});
