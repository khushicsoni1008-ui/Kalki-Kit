// ==========================================================================
// KALKI-KIT NEWS FACT-CHECK BACKEND
// Evidence-first verification: Gemini plans the searches, free sources
// (Google News, fact-checkers, Wikipedia) supply the evidence, Gemini judges
// only that evidence. See free_verifier.js for the pipeline itself.
// ==========================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const freeVerifier = require('./free_verifier');
const imageVerifier = require('./image_verifier');
const linkChecker = require('./link_checker');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_CLAIM_LENGTH = 1500;

if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
app.disable('x-powered-by');

// ==========================================================================
// 1. SECURITY: headers, CORS, body size
// ==========================================================================
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
        // Blocks framing, <base> hijacking, plugins and off-site form posts without restricting the CDN scripts the UI uses
        'Content-Security-Policy': "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    });
    next();
});

// The UI is served from this same server, so CORS is only needed when the page is opened from another
// local dev origin (for example VS Code Live Server). Add more with ALLOWED_ORIGINS=https://a.com,https://b.com
const allowedOrigins = new Set([
    `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
    'http://localhost:5500', 'http://127.0.0.1:5500',
    ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
]);
app.use(cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/api/verify-image', express.json({ limit: '4mb' })); // a downsized picture, base64-encoded
app.use(express.json({ limit: '20kb' })); // everything else is a few hundred characters at most

// Only the web app is public: not server code, .env, tests, docs or node_modules
const PUBLIC_DIRS = ['css', 'js', 'assets'];
const PUBLIC_FILES = ['index.html', 'login.html'];
app.get('/', (req, res) => res.redirect('/index.html'));
app.get('/favicon.ico', (req, res) => res.type('image/svg+xml').sendFile(path.join(__dirname, 'assets', 'favicon.svg')));
PUBLIC_FILES.forEach(file => app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file))));
PUBLIC_DIRS.forEach(dir => app.use('/' + dir, express.static(path.join(__dirname, dir), { dotfiles: 'ignore', index: false })));

// ==========================================================================
// 2. RATE LIMITING (in memory, per client address)
// ==========================================================================
function rateLimit({ windowMs, max, message }) {
    const hits = new Map(); // key -> [timestamps]
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, times] of hits) {
            const recent = times.filter(t => t > cutoff);
            if (recent.length) hits.set(key, recent); else hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const now = Date.now();
        const times = (hits.get(req.ip) || []).filter(t => t > now - windowMs);
        if (times.length >= max) {
            res.set('Retry-After', String(Math.ceil((times[0] + windowMs - now) / 1000)));
            return res.status(429).json({ error: message });
        }
        times.push(now);
        hits.set(req.ip, times);
        next();
    };
}

const guestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: 'Too many guest sign-ins. Please try again later.' });
const verifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: 'Too many checks in a short time. Please wait a few minutes and try again.' });
const imageLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Too many image checks in a short time. Please wait a few minutes and try again.' });
const linkLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many link checks in a short time. Please wait a few minutes and try again.' });
const feedLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, message: 'Please wait a moment before refreshing again.' });

// ==========================================================================
// 3. API ACCESS CONTROL
// Protected routes need "Authorization: Bearer <token>": either a Firebase ID
// token (real login) or a short-lived guest token from /api/guest-session.
// ==========================================================================
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAoZVlnct1nw4c1gjOL-Nmzne5eGlKI298'; // public web key, same as js/auth.js
const GUEST_TTL_MS = 12 * 3600 * 1000;
const TOKEN_CACHE_MS = 5 * 60 * 1000;
const MAX_GUEST_SESSIONS = 5000;
const guestSessions = new Map();          // guest token -> expiry timestamp
const verifiedFirebaseTokens = new Map(); // Firebase ID token -> cache expiry timestamp

function pruneExpired(map) {
    const now = Date.now();
    for (const [key, expiresAt] of map) if (expiresAt <= now) map.delete(key);
}

async function isValidFirebaseToken(idToken) {
    if ((verifiedFirebaseTokens.get(idToken) || 0) > Date.now()) return true;
    try {
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
            signal: AbortSignal.timeout(10000)
        });
        if (!r.ok) return false;
        const data = await r.json();
        if (!data.users || data.users.length === 0) return false;
        pruneExpired(verifiedFirebaseTokens);
        verifiedFirebaseTokens.set(idToken, Date.now() + TOKEN_CACHE_MS);
        return true;
    } catch (e) {
        return false;
    }
}

async function requireAuth(req, res, next) {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const token = match && match[1];
    if (token && token.length < 4096) {
        // Firebase ID tokens are JWTs (contain dots); guest tokens are plain hex
        const ok = token.includes('.')
            ? await isValidFirebaseToken(token)
            : (guestSessions.get(token) || 0) > Date.now();
        if (ok) return next();
    }
    return res.status(401).json({ error: 'Login required.' });
}

app.post('/api/guest-session', guestLimiter, (req, res) => {
    pruneExpired(guestSessions);
    if (guestSessions.size >= MAX_GUEST_SESSIONS) {
        return res.status(503).json({ error: 'Guest access is busy right now. Please try again shortly.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + GUEST_TTL_MS;
    guestSessions.set(token, expiresAt);
    res.json({ token, expiresAt });
});

// ==========================================================================
// 4. SOURCE AUTHORITY CLASSIFIER (No Fake Precision)
// ==========================================================================
function classifySourceAuthority(urlStr, publisherName = '') {
    if (!urlStr) {
        return { tier: 'LOW', score: 45, type: 'Web Publication', domain: 'unknown' };
    }

    try {
        const parsed = new URL(urlStr);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

        // Tier 1: VERY HIGH (Official Government, International Bodies, Top Academic Institutions)
        if (host.endsWith('.gov') || host.includes('.gov.') || host.includes('.nic.in') || host.endsWith('.mil') ||
            host.includes('un.org') || host.includes('who.int') || host.includes('worldbank.org') || host.includes('unesco.org') ||
            host.includes('nasa.gov') || host.includes('isro.gov.in') || host.includes('eci.gov.in') || host.includes('fec.gov') ||
            host.includes('nih.gov') || host.includes('cdc.gov') || host.includes('pmindia.gov.in') || host.includes('presidentofindia.gov.in')) {
            return { tier: 'VERY HIGH', score: 98, type: 'Official / Government', domain: host };
        }

        if (host.endsWith('.edu') || host.includes('.ac.in') || host.includes('.ac.uk') || host.endsWith('.edu.') ||
            host.includes('nobelprize.org') || host.includes('nature.com') || host.includes('science.org') ||
            host.includes('ncbi.nlm.nih.gov') || host.includes('arxiv.org') || host.includes('cell.com') ||
            host.includes('thelancet.com') || host.includes('sciencedirect.com') || host.includes('jstor.org') ||
            host.includes('mit.edu') || host.includes('harvard.edu') || host.includes('ox.ac.uk') || host.includes('cam.ac.uk')) {
            return { tier: 'VERY HIGH', score: 97, type: 'Academic / Research', domain: host };
        }

        // Tier 2: HIGH (Certified Fact-Checkers and Major Reputable Global Wire Agencies)
        if (host.includes('snopes.com') || host.includes('politifact.com') || host.includes('factcheck.org') ||
            host.includes('boomlive.in') || host.includes('altnews.in') || host.includes('afp.com') ||
            host.includes('fullfact.org') || host.includes('reuters.com/fact-check') || host.includes('factchecker.in')) {
            return { tier: 'HIGH', score: 94, type: 'Certified Fact-Checker', domain: host };
        }

        if (host.includes('reuters.com') || host.includes('apnews.com') || host.includes('bbc.com') || host.includes('bbc.co.uk') ||
            host.includes('thehindu.com') || host.includes('nytimes.com') || host.includes('washingtonpost.com') ||
            host.includes('wsj.com') || host.includes('bloomberg.com') || host.includes('theguardian.com') ||
            host.includes('economist.com') || host.includes('ft.com') || host.includes('aljazeera.com') ||
            host.includes('timesofindia.indiatimes.com') || host.includes('hindustantimes.com') || host.includes('indianexpress.com') ||
            host.includes('business-standard.com') || host.includes('ndtv.com') || host.includes('indiatoday.in')) {
            return { tier: 'HIGH', score: 90, type: 'Major News Outlet', domain: host };
        }

        // Tier 3: MEDIUM (Reputable Encyclopedias, Mainstream Reference)
        if (host.includes('wikipedia.org') || host.includes('britannica.com') || host.includes('nationalgeographic.com') ||
            host.includes('scientificamerican.com') || host.includes('space.com') || host.includes('forbes.com') ||
            host.includes('time.com') || host.includes('investopedia.com') || host.includes('merriam-webster.com') ||
            host.includes('google.com/rss')) {
            return { tier: 'MEDIUM', score: 75, type: 'Reference / Encyclopedia', domain: host };
        }

        // Tier 4: VERY LOW (Social Media & User-Generated Content)
        if (host.includes('twitter.com') || host.includes('x.com') || host.includes('reddit.com') ||
            host.includes('facebook.com') || host.includes('tiktok.com') || host.includes('instagram.com') ||
            host.includes('quora.com') || host.includes('threads.net') || host.includes('medium.com')) {
            return { tier: 'VERY LOW', score: 25, type: 'Social Media / Forum', domain: host };
        }

        return { tier: 'MEDIUM', score: 65, type: 'Web Publication', domain: host };
    } catch (e) {
        return { tier: 'LOW', score: 45, type: 'Web Publication', domain: 'unknown' };
    }
}

// ==========================================================================
// 5. VERIFICATION (cached, de-duplicated and capped)
// ==========================================================================
const RESULT_TTL_MS = 15 * 60 * 1000;   // news moves: keep answers fresh
const RESULT_CACHE_MAX = 200;
const MAX_CONCURRENT_CHECKS = 8;        // protects the Gemini quota and the server
const resultCache = new Map();          // key -> { at, result }
const inFlight = new Map();             // key -> Promise<result>
let activeChecks = 0;

function cacheKey(claim) {
    return claim.toLowerCase().replace(/\s+/g, ' ').trim();
}

// One runner for every kind of check: same answer within 15 minutes is served from memory, the same
// request made twice at once shares one run, and too many checks at once are turned away politely.
async function runCached(key, producer) {
    const cached = resultCache.get(key);
    if (cached && Date.now() - cached.at < RESULT_TTL_MS) return { ...cached.result, cached: true };

    if (inFlight.has(key)) return inFlight.get(key);

    if (activeChecks >= MAX_CONCURRENT_CHECKS) {
        const err = new Error('busy');
        err.code = 'BUSY';
        throw err;
    }

    activeChecks++;
    const run = producer()
        .then(result => {
            // A result produced while the AI judge was unavailable is not worth remembering
            if (!result.warning) {
                resultCache.set(key, { at: Date.now(), result });
                if (resultCache.size > RESULT_CACHE_MAX) resultCache.delete(resultCache.keys().next().value);
            }
            return result;
        })
        .finally(() => { activeChecks--; inFlight.delete(key); });
    inFlight.set(key, run);
    return run;
}

function verifyWithCache(claim, apiKey) {
    return runCached('claim:' + cacheKey(claim), () =>
        freeVerifier.verifyClaim(claim, { apiKey, modelName: DEFAULT_MODEL, classifySourceAuthority }));
}

// ==========================================================================
// 6. API ROUTES
// ==========================================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5)
    });
});

app.post('/api/verify', verifyLimiter, requireAuth, async (req, res) => {
    const { claim } = req.body || {};
    if (typeof claim !== 'string' || claim.trim().length === 0) {
        return res.status(400).json({ error: 'Please enter a news claim to verify.' });
    }
    if (claim.length > MAX_CLAIM_LENGTH * 2) {
        return res.status(400).json({ error: `That text is too long. Please keep it under ${MAX_CLAIM_LENGTH} characters.` });
    }

    try {
        const result = await verifyWithCache(claim.trim(), process.env.GEMINI_API_KEY || '');
        return res.json(result);
    } catch (err) {
        if (err.code === 'BUSY') {
            res.set('Retry-After', '10');
            return res.status(503).json({ error: 'The service is busy right now. Please try again in a few seconds.' });
        }
        console.error('[KALKI Backend] Verification error:', err);
        return res.status(500).json({ error: 'Something went wrong while checking this claim. Please try again.' });
    }
});

function sendCheckError(res, err, what) {
    if (err.code === 'BUSY') {
        res.set('Retry-After', '10');
        return res.status(503).json({ error: 'The service is busy right now. Please try again in a few seconds.' });
    }
    console.error(`[KALKI Backend] ${what} error:`, err.code || '', err.message);
    return res.status(500).json({ error: `Something went wrong while checking this ${what}. Please try again.` });
}

// Image check: the browser sends a downsized copy plus a few plain facts read from the original file
app.post('/api/verify-image', imageLimiter, requireAuth, async (req, res) => {
    const { imageBase64, claim, metadata } = req.body || {};
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100 || imageBase64.length > 4.2 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
        return res.status(400).json({ error: 'Please choose a valid image file.' });
    }
    const buffer = Buffer.from(imageBase64, 'base64');
    if (buffer.length > imageVerifier.MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: 'That image is too large. Please try a smaller one.' });
    }
    const mime = imageVerifier.sniffMime(buffer);
    if (!mime) return res.status(400).json({ error: 'Only JPG, PNG and WebP images can be checked.' });
    if (claim != null && (typeof claim !== 'string' || claim.length > 1000)) {
        return res.status(400).json({ error: 'That description is not valid or is too long.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) return res.status(503).json({ error: 'Image checking needs an AI key, and none is configured on this server.' });

    try {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const result = await runCached(`image:${hash}:${cacheKey(claim || '')}`, () =>
            imageVerifier.analyzeImage({ buffer, mime, claim, metadata, apiKey, modelName: DEFAULT_MODEL, classify: classifySourceAuthority }));
        return res.json(result);
    } catch (err) {
        return sendCheckError(res, err, 'image');
    }
});

// Link check: read the article, pull out its main claim, check that claim
app.post('/api/verify-link', linkLimiter, requireAuth, async (req, res) => {
    const { url } = req.body || {};
    if (typeof url !== 'string' || url.trim().length < 8 || url.length > 2000) {
        return res.status(400).json({ error: 'Please paste a full web link, starting with https://' });
    }
    try {
        linkChecker.parsePublicUrl(url); // refuse private or odd addresses before doing any work
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) return res.status(503).json({ error: 'Link checking needs an AI key, and none is configured on this server.' });

    try {
        const result = await runCached('link:' + url.trim().toLowerCase(), () =>
            linkChecker.checkLink({ url: url.trim(), apiKey, modelName: DEFAULT_MODEL, classify: classifySourceAuthority }));
        return res.json(result);
    } catch (err) {
        if (err instanceof linkChecker.LinkError) return res.status(422).json({ error: err.message, code: err.code });
        return sendCheckError(res, err, 'link');
    }
});

// What the fact-checking sites published most recently
let latestCache = { at: 0, items: [] };
app.get('/api/latest-factchecks', feedLimiter, requireAuth, async (req, res) => {
    try {
        if (Date.now() - latestCache.at > 5 * 60 * 1000 || !latestCache.items.length) {
            const items = await freeVerifier.fetchLatestFactChecks(16);
            if (items.length) latestCache = { at: Date.now(), items };
        }
        return res.json({ items: latestCache.items, updatedAt: latestCache.at });
    } catch (err) {
        return res.status(502).json({ error: 'Could not load the latest fact-checks right now.' });
    }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Last-resort handler: bad JSON, oversized bodies, CORS rejections. Never leaks internals.
app.use((err, req, res, next) => {
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 413 ? 'That request is too large.' : status === 400 ? 'Invalid request.' : 'Server error.' });
});

// Start Server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('================================================================');
        console.log(`KALKI-KIT news fact-check server running on http://localhost:${PORT}`);
        console.log(`Gemini model: ${DEFAULT_MODEL} | API key: ${process.env.GEMINI_API_KEY ? 'configured' : 'MISSING (add GEMINI_API_KEY to .env)'}`);
        console.log('================================================================');
        freeVerifier.warmUp();
        freeVerifier.startHealthProbe(process.env.GEMINI_API_KEY, DEFAULT_MODEL);
    });
}

// Kept for the accuracy script in scratch/run_8_tests.js
const executeUniversalVerification = (claim, apiKey, modelName) =>
    freeVerifier.verifyClaim(claim, { apiKey, modelName: modelName || DEFAULT_MODEL, classifySourceAuthority });

module.exports = { app, executeUniversalVerification };
