// ==========================================================================
// KALKI-KIT IMAGE CHECK PAGE
// Upload or paste a picture. The server's vision model describes it and lists
// visible signs of AI generation or editing; the browser reads the file's own
// metadata. If a claim comes with the picture, that claim is fact-checked too.
// This is an opinion from visible clues, never proof either way.
// ==========================================================================

(function () {
    const MAX_FILE_MB = 15;
    const CLIENT_TIMEOUT_MS = 120000;

    const LEVELS = { LOW: { n: 1, label: 'Low' }, MEDIUM: { n: 2, label: 'Medium' }, HIGH: { n: 3, label: 'High' } };
    const TYPES = { PHOTO: 'Photo', SCREENSHOT: 'Screenshot', NEWS_GRAPHIC: 'News graphic', MEME: 'Meme', CHART: 'Chart or diagram', ILLUSTRATION: 'Illustration', OTHER: 'Image' };
    const STRENGTH = { WEAK: 'Weak', MODERATE: 'Moderate', STRONG: 'Strong' };

    const SEARCH_TOOLS = [
        { name: 'Google Lens', url: 'https://lens.google.com/', icon: 'fa-brands fa-google' },
        { name: 'TinEye', url: 'https://tineye.com/', icon: 'fa-solid fa-magnifying-glass' },
        { name: 'Bing Visual Search', url: 'https://www.bing.com/visualsearch', icon: 'fa-brands fa-microsoft' },
        { name: 'Yandex Images', url: 'https://yandex.com/images/', icon: 'fa-solid fa-globe' }
    ];

    // Survives switching to another page and back
    const session = { prep: null, file: null, meta: null, claim: '', result: null, ctx: null };
    let running = null;

    const verdictFor = res => window.getVerdict(res.status);

    function levelHtml(level) {
        const l = LEVELS[level] || LEVELS.LOW;
        return `
            <div class="fc-level" role="img" aria-label="Confidence in this assessment: ${l.label}">
                <span class="fc-eyebrow">How sure we are</span>
                <div class="fc-level-bars l${l.n}"><i></i><i></i><i></i></div>
                <strong>${l.label}</strong>
            </div>`;
    }

    function signsHtml(title, icon, cls, list) {
        return `
            <div class="fc-signs-col ${cls}">
                <h4><i class="fa-solid ${icon}"></i> ${title}</h4>
                ${list.length ? `<ul>${list.map(s => `<li>${window.esc(s.sign)} <span class="fc-pill muted">${STRENGTH[s.strength] || 'Weak'}</span></li>`).join('')}</ul>` : '<p class="fc-none">None noticed</p>'}
            </div>`;
    }

    function factRows(meta, ctx) {
        const yes = (ok, okText, noText) => ok ? `<span class="fc-fact-yes"><i class="fa-solid fa-circle-check"></i> ${okText}</span>` : `<span class="fc-fact-no">${noText}</span>`;
        const rows = [
            ['Format', `${meta.format || 'Image'} · ${meta.sizeKB >= 1024 ? (meta.sizeKB / 1024).toFixed(1) + ' MB' : meta.sizeKB + ' KB'}`],
            ['Size in pixels', ctx.width && ctx.height ? `${ctx.width} × ${ctx.height}` : ''],
            ['Camera', meta.camera || ''],
            ['Editing software', meta.software || ''],
            ['Date in the file', meta.takenAt || ''],
            ['Location data', meta.gps ? 'Present in the file' : ''],
            ['Content Credentials (C2PA)', meta.credentials ? 'Found in the file. We can read that it is there but cannot verify its signature.' : ''],
            ['AI tool named in the file', meta.aiTool || '']
        ].filter(r => r[1]);
        const hasAny = Boolean(meta.camera || meta.software || meta.takenAt || meta.credentials || meta.aiTool);
        return `
            <dl class="fc-facts">
                ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${window.esc(v)}</dd></div>`).join('')}
            </dl>
            ${meta.aiTool ? `<div class="fc-alert warn mt-2 mb-0"><i class="fa-solid fa-robot"></i><div>The file itself mentions <strong>${window.esc(meta.aiTool)}</strong>. That is a strong hint the image was made with an AI tool.</div></div>` : ''}
            <p class="fc-link-note mt-2 mb-0"><i class="fa-solid fa-circle-info"></i> ${hasAny
                ? 'These details can be edited or removed, so treat them as hints.'
                : 'No camera, software or date was found. That is normal: WhatsApp, Facebook, X and most apps strip this information, so it says nothing about whether the image is real.'}</p>`;
    }

    function imageSummaryText(res, ctx) {
        const v = verdictFor(res);
        const lines = [
            'Image check by Kalki-Kit',
            `Result: ${v.label} (${(LEVELS[res.confidenceLevel] || LEVELS.LOW).label.toLowerCase()} confidence)`,
            `Why: ${res.reason}`,
            `What we see: ${res.description}`
        ];
        if (res.claimResult && res.claimChecked) {
            lines.push(`Claim checked: "${res.claimChecked}" → ${window.getVerdict(res.claimResult.verdict).label}`);
            if (res.claimResult.correction) lines.push(`Correct information: ${res.claimResult.correction}`);
        }
        lines.push('This is an opinion from visible clues, not proof. Always check where an image first appeared.');
        return lines.join('\n');
    }

    function resultHtml(res, ctx) {
        const v = verdictFor(res);
        const preview = ctx.previewUrl || ctx.thumb;
        const sig = res.signals || { ai: [], edit: [], authentic: [] };
        const claimQ = encodeURIComponent((res.claimChecked || ctx.claim || res.imageClaim || '').slice(0, 200));

        return `
            <div class="fc-result fade-in" id="fc-result" tabindex="-1">
                <div class="fc-img-echo">
                    ${preview ? `<img src="${window.esc(preview)}" alt="The image you checked">` : ''}
                    <div>
                        <span class="fc-eyebrow">${ctx.fromHistory ? 'Saved image check' : 'You checked'}</span>
                        <p class="mb-1">${window.esc(ctx.claim ? `“${ctx.claim}”` : (res.description || 'Image').slice(0, 140))}</p>
                        <span class="fc-pill muted">${TYPES[res.imageType] || TYPES.OTHER}</span>
                    </div>
                </div>

                <section class="fc-verdict is-${v.key}" aria-labelledby="fc-verdict-label">
                    <div class="fc-verdict-icon" aria-hidden="true"><i class="fa-solid ${v.icon}"></i></div>
                    <div class="fc-verdict-body">
                        <span class="fc-eyebrow">What we noticed</span>
                        <h2 id="fc-verdict-label">${v.label}</h2>
                        <p>${v.meaning}</p>
                    </div>
                    ${levelHtml(res.confidenceLevel)}
                </section>
                <p class="fc-opinion"><i class="fa-solid fa-scale-balanced"></i> This is an opinion based on visible clues, not proof. Even experts cannot always tell from the pixels alone.</p>

                <section class="fc-card">
                    <h3><i class="fa-solid fa-lightbulb"></i> Why we say this</h3>
                    <p class="fc-lead">${window.esc(res.reason || 'No explanation available.')}</p>
                    ${(res.notes || []).map(n => `<p class="fc-body-text mt-2 mb-0"><i class="fa-solid fa-circle-info text-muted"></i> ${window.esc(n)}</p>`).join('')}
                </section>

                <section class="fc-card">
                    <h3><i class="fa-solid fa-eye"></i> What we can see</h3>
                    <p class="fc-body-text">${window.esc(res.description)}</p>
                    ${res.visibleText ? `<div class="fc-quote"><span class="fc-eyebrow">Text in the image</span><p>${window.esc(res.visibleText)}</p></div>` : ''}
                    ${(res.contextClues || []).length ? `<div class="fc-clues">${res.contextClues.map(c => `<span class="fc-chip static">${window.esc(c)}</span>`).join('')}</div>` : ''}
                </section>

                <section class="fc-card">
                    <h3><i class="fa-solid fa-magnifying-glass-plus"></i> Signs we looked for</h3>
                    <div class="fc-signs">
                        ${signsHtml('Possible AI generation', 'fa-robot', 'ai', sig.ai)}
                        ${signsHtml('Possible editing', 'fa-scissors', 'edit', sig.edit)}
                        ${signsHtml('Fits a normal camera photo', 'fa-camera', 'real', sig.authentic)}
                    </div>
                </section>

                <section class="fc-card">
                    <h3><i class="fa-solid fa-file-circle-info"></i> Details inside the file</h3>
                    ${factRows(ctx.meta || {}, ctx)}
                </section>

                <section class="fc-card fc-reverse">
                    <h3><i class="fa-solid fa-route"></i> Find where this image came from</h3>
                    <p class="fc-body-text">The best test of a viral image is finding its <strong>first appearance</strong>. An old photo shared as news, or one that shows up with a different story elsewhere, is a red flag.</p>
                    <ol class="fc-steps-mini">
                        <li>${ctx.hasBlob ? 'Press <strong>Copy image</strong> below, or use the original file.' : 'Have the original file ready.'}</li>
                        <li>Open one of the search tools and paste the image (Ctrl+V) or upload it.</li>
                        <li>Look at the oldest results and at who else used it, and with what story.</li>
                    </ol>
                    <div class="fc-find">
                        ${ctx.hasBlob ? '<button type="button" class="btn btn-sm btn-primary" data-action="copy-image"><i class="fa-regular fa-copy"></i> Copy image</button>' : ''}
                        ${SEARCH_TOOLS.map(t => `<a class="btn btn-sm btn-outline-secondary" href="${t.url}" target="_blank" rel="noopener noreferrer"><i class="${t.icon}"></i> ${t.name}</a>`).join('')}
                        ${claimQ ? `<a class="btn btn-sm btn-outline-secondary" href="https://toolbox.google.com/factcheck/explorer/search/${claimQ}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-shield-halved"></i> Search fact-checks</a>` : ''}
                    </div>
                </section>

                ${res.imageClaim && res.imageClaim !== res.claimChecked ? `
                <section class="fc-card">
                    <h3><i class="fa-solid fa-quote-left"></i> A claim written in the image</h3>
                    <p class="fc-lead">“${window.esc(res.imageClaim)}”</p>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-claim-check="${window.esc(res.imageClaim)}"><i class="fa-solid fa-magnifying-glass"></i> Fact-check this claim</button>
                </section>` : ''}

                ${res.claimResult && res.claimChecked ? `
                <div class="fc-subhead"><i class="fa-solid fa-newspaper"></i> Claim check</div>
                ${window.FC.resultHtml(res.claimResult, res.claimChecked, false, { eyebrow: ctx.claim ? 'Claim you gave us' : 'Claim written in the image', actions: false, id: false })}` : ''}

                <div class="fc-actions">
                    <button class="btn btn-outline-secondary" data-action="copy-summary"><i class="fa-regular fa-copy"></i> Copy summary</button>
                    <button class="btn btn-primary ms-sm-auto" data-action="again"><i class="fa-solid fa-rotate-right"></i> Check another image</button>
                </div>
                <p class="fc-disclaimer"><i class="fa-solid fa-circle-info"></i> AI-assisted opinion. Always check where an image first appeared before sharing it.</p>
            </div>`;
    }

    // Saved shape: a thumbnail, the verdict, and enough to redraw the full result later
    function toRecord(res, ctx) {
        const { claimResult, ...imageResult } = res;
        const title = (ctx.claim || res.imageClaim || res.description || 'Image check').slice(0, 140);
        return {
            kind: 'image',
            title,
            status: res.status,
            verdict: res.status,
            category: 'Image',
            confidence: null,
            confidenceLevel: res.confidenceLevel,
            thumb: ctx.thumb,
            why: res.reason,
            correctInfo: res.description,
            claimText: ctx.claim,
            fileMeta: ctx.meta,
            width: ctx.width,
            height: ctx.height,
            imageResult,
            claimRecord: claimResult && res.claimChecked ? window.FC.toRecord(claimResult, res.claimChecked) : null,
            sources: []
        };
    }

    function fromRecord(rec) {
        const res = { ...rec.imageResult, claimResult: rec.claimRecord || null };
        const ctx = { thumb: rec.thumb, claim: rec.claimText || '', meta: rec.fileMeta || {}, width: rec.width, height: rec.height, fromHistory: true, hasBlob: false };
        return { res, ctx };
    }

    function pastedImage(e) {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        for (const item of items) if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
        return null;
    }

    window.renderImageCheck = function (container) {
        container.innerHTML = `
            <div class="fc-page fade-in">
                <section class="fc-hero">
                    <h1>Is this image <span class="text-gradient">real?</span></h1>
                    <p class="fc-sub">Upload a photo or screenshot. We look for signs of AI generation or editing, read any text in it, and fact-check any claim that comes with it. We never identify people from their faces.</p>

                    <form id="img-form" novalidate>
                        <div id="img-drop" class="fc-drop" tabindex="0" role="button" aria-label="Choose an image to check. You can also drop a file here or paste with Control V.">
                            <input type="file" id="img-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                            <div class="fc-drop-idle" id="img-idle">
                                <i class="fa-regular fa-image" aria-hidden="true"></i>
                                <strong>Drop an image here, click to choose, or paste it (Ctrl+V)</strong>
                                <span>JPG, PNG, WebP or GIF · up to ${MAX_FILE_MB} MB</span>
                            </div>
                            <div class="fc-drop-picked" id="img-picked" hidden>
                                <img id="img-thumb" alt="Preview of the chosen image">
                                <div class="fc-drop-info">
                                    <strong id="img-name"></strong>
                                    <span id="img-detail"></span>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" id="img-remove">Remove</button>
                                </div>
                            </div>
                        </div>

                        <label for="img-claim" class="form-label mt-3 mb-1">What is this image claimed to show? <span class="text-muted fw-normal">(optional)</span></label>
                        <textarea id="img-claim" class="form-control" rows="2" maxlength="500" placeholder="Example: A viral post says this shows flooding in Mumbai this week"></textarea>
                        <div class="fc-input-foot"><span class="fc-hint">If the image is shared with a claim or caption, add it and we will fact-check that as well.</span></div>

                        <div class="fc-form-actions">
                            <button type="submit" class="btn btn-primary btn-lg" id="btn-check-image" disabled><i class="fa-solid fa-magnifying-glass"></i> Check this image</button>
                        </div>
                    </form>
                    <p class="fc-privacy"><i class="fa-solid fa-lock"></i> Your image is sent to Google's Gemini AI to be analysed. It is not stored on our server, and only a small thumbnail is kept in this browser.</p>
                </section>

                <div id="img-status" class="fc-status" role="status" aria-live="polite"></div>
                <div id="img-output"></div>
            </div>`;

        const page = container.firstElementChild;
        const drop = page.querySelector('#img-drop');
        const fileInput = page.querySelector('#img-file');
        const claimInput = page.querySelector('#img-claim');
        const btn = page.querySelector('#btn-check-image');
        const status = page.querySelector('#img-status');
        const output = page.querySelector('#img-output');
        const alive = () => page.isConnected;

        function paintPicked() {
            const has = Boolean(session.prep);
            page.querySelector('#img-idle').hidden = has;
            page.querySelector('#img-picked').hidden = !has;
            btn.disabled = !has || Boolean(running);
            if (has) {
                page.querySelector('#img-thumb').src = session.prep.previewUrl;
                page.querySelector('#img-name').textContent = session.file ? session.file.name : 'Pasted image';
                page.querySelector('#img-detail').textContent = `${session.prep.width} × ${session.prep.height} px · ${session.meta ? (session.meta.sizeKB >= 1024 ? (session.meta.sizeKB / 1024).toFixed(1) + ' MB' : session.meta.sizeKB + ' KB') : ''}`;
            }
        }

        function showError(message, canRetry) {
            status.innerHTML = `
                <div class="fc-alert error" role="alert">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <div>${window.esc(message)}</div>
                    ${canRetry ? '<button type="button" class="btn btn-sm btn-outline-danger ms-auto" data-action="retry">Try again</button>' : ''}
                </div>`;
        }

        async function pickFile(file) {
            if (!file) return;
            if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { showError('Please choose a JPG, PNG, WebP or GIF image.', false); return; }
            if (file.size > MAX_FILE_MB * 1024 * 1024) { showError(`That image is larger than ${MAX_FILE_MB} MB. Please choose a smaller one.`, false); return; }
            status.innerHTML = '<div class="fc-alert info"><span class="spinner-border spinner-border-sm"></span><div>Preparing your image…</div></div>';
            try {
                const [prep, meta] = await Promise.all([window.prepareImage(file), window.readImageMetadata(file)]);
                if (session.prep && session.prep.previewUrl) URL.revokeObjectURL(session.prep.previewUrl);
                Object.assign(session, { prep, meta, file, result: null, ctx: null });
                status.innerHTML = '';
                output.innerHTML = '';
                if (alive()) paintPicked();
            } catch (err) {
                if (alive()) showError(err.message || 'That file could not be opened as an image.', false);
            }
        }

        function clearImage() {
            if (session.prep && session.prep.previewUrl) URL.revokeObjectURL(session.prep.previewUrl);
            Object.assign(session, { prep: null, file: null, meta: null, result: null, ctx: null });
            fileInput.value = '';
            status.innerHTML = '';
            output.innerHTML = '';
            paintPicked();
        }

        function showResult(res, ctx, scroll = true) {
            status.innerHTML = '';
            output.innerHTML = resultHtml(res, ctx);
            const el = output.querySelector('#fc-result');
            if (el && scroll) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); }
        }

        async function run() {
            if (running || !session.prep) return;
            const claim = claimInput.value.replace(/\s+/g, ' ').trim();
            output.innerHTML = '';
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking…';

            const startedAt = Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort('timeout'), CLIENT_TIMEOUT_MS);
            const msgs = ['Looking closely at the image and reading any text in it…', 'Still working. The AI service is a little busy, so this is taking longer than usual…', 'Almost there. Busy periods can take up to a minute…'];
            const ticker = setInterval(() => {
                if (!alive()) return;
                const secs = Math.round((Date.now() - startedAt) / 1000);
                const el = status.querySelector('[data-progress-text]');
                if (el) el.textContent = secs < 12 ? msgs[0] : secs < 30 ? msgs[1] : msgs[2];
                const t = status.querySelector('[data-progress-time]');
                if (t) t.textContent = `${secs}s`;
            }, 1000);
            running = { controller };

            status.innerHTML = `
                <div class="fc-progress">
                    <div class="spinner-border text-primary" aria-hidden="true"></div>
                    <div class="fc-progress-text"><strong>Checking your image</strong><span data-progress-text>${msgs[0]}</span></div>
                    <span class="fc-progress-time" data-progress-time>0s</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel">Cancel</button>
                </div>`;

            const meta = session.meta || {};
            try {
                const res = await window.authFetch(`${window.getBackendBase()}/api/verify-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageBase64: session.prep.base64,
                        claim,
                        metadata: { camera: meta.camera, software: meta.software, takenAt: meta.takenAt, aiTool: meta.aiTool, credentials: meta.credentials, gps: meta.gps, width: session.prep.width, height: session.prep.height }
                    }),
                    signal: controller.signal
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    const fallback = res.status === 429 ? 'Too many image checks in a short time. Please wait a few minutes.'
                        : res.status === 413 ? 'That image is too large. Please try a smaller one.'
                        : res.status === 401 ? 'Your session expired. Please sign in again.'
                        : 'Something went wrong while checking this image. Please try again.';
                    throw Object.assign(new Error(err.error || fallback), { handled: true });
                }

                const result = await res.json();
                const ctx = { previewUrl: session.prep.previewUrl, thumb: '', claim, meta, width: session.prep.width, height: session.prep.height, hasBlob: true };
                ctx.thumb = session.prep.thumb;
                session.result = result;
                session.ctx = ctx;
                window.KalkiData.addClaim(toRecord(result, ctx));

                if (alive()) showResult(result, ctx);
                else window.showKalkiToast('Image check finished', `${verdictFor(result).label}`, 'success');
            } catch (err) {
                if (!alive()) return;
                if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
                    status.innerHTML = '<div class="fc-alert info"><i class="fa-solid fa-ban"></i><div>Check cancelled.</div></div>';
                } else if (controller.signal.reason === 'timeout') {
                    showError('This is taking too long. The services we rely on may be busy. Please try again in a moment.', true);
                } else if (err.handled) {
                    showError(err.message, true);
                } else {
                    showError('Could not reach the server. Check that it is running and your internet connection is working, then try again.', true);
                }
            } finally {
                clearTimeout(timeout);
                clearInterval(ticker);
                running = null;
                if (alive()) {
                    btn.disabled = !session.prep;
                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Check this image';
                }
            }
        }

        async function copyImage() {
            try {
                const bitmap = await createImageBitmap(session.prep.blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0);
                const png = await new Promise(res => canvas.toBlob(res, 'image/png'));
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
                window.showKalkiToast('Image copied', 'Now paste it (Ctrl+V) on the search site.', 'success');
            } catch (err) {
                window.showKalkiToast('Could not copy the image', 'Please upload the original file on the search site instead.', 'warning');
            }
        }

        // Events
        drop.addEventListener('click', e => { if (!e.target.closest('#img-remove')) fileInput.click(); });
        drop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) { e.preventDefault(); fileInput.click(); } });
        fileInput.addEventListener('change', () => pickFile(fileInput.files[0]));
        ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
        drop.addEventListener('drop', e => pickFile(e.dataTransfer.files[0]));
        page.querySelector('#img-remove').addEventListener('click', e => { e.stopPropagation(); clearImage(); });
        page.querySelector('#img-form').addEventListener('submit', e => { e.preventDefault(); run(); });
        claimInput.addEventListener('input', () => { session.claim = claimInput.value; });

        // Pasting a screenshot anywhere on the page works; the listener removes itself when the page is left
        const onPaste = e => {
            if (!alive()) { document.removeEventListener('paste', onPaste); return; }
            const file = pastedImage(e);
            if (file) { e.preventDefault(); pickFile(file); }
        };
        document.addEventListener('paste', onPaste);

        page.addEventListener('click', async e => {
            const t = e.target.closest('[data-action],[data-claim-check]');
            if (!t) return;
            if (t.dataset.claimCheck) { window.prefillClaim(t.dataset.claimCheck); return; }
            const action = t.dataset.action;
            if (action === 'cancel' && running) running.controller.abort('cancel');
            else if (action === 'retry') run();
            else if (action === 'again') { clearImage(); claimInput.value = ''; session.claim = ''; container.scrollTo({ top: 0, behavior: 'smooth' }); }
            else if (action === 'copy-image' && session.prep) copyImage();
            else if (action === 'copy-summary' && session.result) {
                try { await navigator.clipboard.writeText(imageSummaryText(session.result, session.ctx)); window.showKalkiToast('Copied', 'The summary is ready to paste.', 'success'); }
                catch (err) { window.showKalkiToast('Could not copy', 'Your browser blocked clipboard access.', 'warning'); }
            } else if (action === 'copy-links' && session.result && session.result.claimResult) {
                await window.FC.handleResultAction('copy-links', session.result.claimResult, session.result.claimChecked);
            }
        });

        // Restore what the user was looking at
        claimInput.value = session.claim;
        paintPicked();
        if (session.result && session.ctx) showResult(session.result, session.ctx, false);
    };

    // Open a saved image check from My Checks or Recent checks
    window.showStoredImage = function (id) {
        const rec = window.KalkiData.getClaims().find(c => c.id === id);
        if (!rec || rec.kind !== 'image' || !rec.imageResult) return;
        const { res, ctx } = fromRecord(rec);
        if (session.prep && session.prep.previewUrl) URL.revokeObjectURL(session.prep.previewUrl);
        Object.assign(session, { prep: null, file: null, meta: null, claim: rec.claimText || '', result: res, ctx });
        window.loadKalkiModule('image');
    };
})();
