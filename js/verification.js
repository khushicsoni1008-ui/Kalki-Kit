// ==========================================================================
// KALKI-KIT FACT CHECK PAGE
// One claim (or one news link) in, one clear verdict out, with the sources
// behind it. The checking itself happens on the server.
// Also exports window.FC: the result rendering the Image Check page reuses.
// ==========================================================================

(function () {
    const MAX_LENGTH = 1500;
    const MIN_LENGTH = 8;
    const CLIENT_TIMEOUT_MS = 120000;

    const EXAMPLES = [
        'Water boils at 100°C at sea level',
        'The Earth is flat',
        'Narendra Modi is the Prime Minister of India'
    ];

    const STANCE = {
        SUPPORTS: { cls: 'supports', label: 'Supports the claim', icon: 'fa-check' },
        CONTRADICTS: { cls: 'contradicts', label: 'Contradicts the claim', icon: 'fa-xmark' },
        CONTEXT: { cls: 'context', label: 'Related coverage', icon: 'fa-circle-info' }
    };

    const PAGE_TYPES = { NEWS: 'News report', OPINION: 'Opinion piece', SATIRE: 'Satire', BLOG: 'Blog post', PRESS_RELEASE: 'Press release', OTHER: 'Web page' };

    const VOICE_LANGS = [['en-IN', 'English (India)'], ['hi-IN', 'हिन्दी'], ['mr-IN', 'मराठी'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)']];

    // Survives switching to another page and back
    const session = { mode: 'claim', draft: '', linkDraft: '', result: null, claim: '', link: null, fromHistory: false };
    let running = null; // { controller } while a check is in progress

    // ----------------------------------------------------------------------
    // Result helpers
    // ----------------------------------------------------------------------
    function confidenceOf(result) {
        const v = result.confidencePercent != null ? result.confidencePercent : result.confidence;
        const n = Number(v);
        if (!isFinite(n)) return null;
        return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
    }

    // Only verdicts that rest on evidence get a percentage
    const hasScore = verdict => !['unverified', 'ambiguous'].includes(verdict.key);

    function normalizeSources(list) {
        return (Array.isArray(list) ? list : []).map(s => ({
            name: s.name || s.publisher || '',
            title: s.title || s.name || '',
            url: window.safeUrl(s.url),
            domain: s.domain && s.domain !== 'unknown' ? String(s.domain) : '',
            backsCorrection: Boolean(s.backsCorrection),
            date: s.publishedDate && s.publishedDate !== 'Reference' ? s.publishedDate : '',
            type: s.type || '',
            trust: typeof s.credibilityScore === 'number' ? s.credibilityScore : null,
            stance: STANCE[s.stance] ? s.stance : 'CONTEXT',
            note: s.evidenceSummary || s.evidence || ''
        })).filter(s => s.title);
    }

    // The saved shape: small, and good enough to show the full result again later
    function toRecord(result, claim) {
        const verdict = String(result.verdict || result.status || 'UNVERIFIED').toUpperCase();
        return {
            title: claim,
            status: verdict,
            verdict,
            confidence: confidenceOf(result),
            category: result.category || 'General',
            why: result.why || result.explanation || '',
            correctInfo: result.correctInfo || '',
            correction: result.correction || '',
            confidenceNote: result.confidenceNote || '',
            claimVsFact: Array.isArray(result.claimVsFact) ? result.claimVsFact.slice(0, 6) : [],
            sources: normalizeSources(result.sources).slice(0, 10),
            searchQueries: Array.isArray(result.searchQueries) ? result.searchQueries.slice(0, 8) : [],
            engine: result.aiEngineAttribution || ''
        };
    }

    // A link check is saved as the claim check for its main claim, plus what we learned about the page
    function toLinkRecord(link) {
        const base = link.claimResult && link.mainClaim
            ? toRecord(link.claimResult, link.mainClaim)
            : { title: link.title, status: 'AMBIGUOUS', verdict: 'AMBIGUOUS', confidence: null, category: 'General', why: 'No checkable factual claim was found on this page.', correctInfo: '', sources: [], claimVsFact: [] };
        return {
            ...base,
            kind: 'link',
            url: link.url,
            domain: link.domain,
            pageTitle: link.title,
            pageType: link.pageType,
            pageSummary: link.summary,
            pageWarnings: link.warnings,
            publisher: link.publisher,
            publishedDate: link.publishedDate,
            otherClaims: link.otherClaims,
            hasClaim: Boolean(link.claimResult && link.mainClaim)
        };
    }

    // Rebuilds what the page needs from a saved link record
    function linkFromRecord(rec) {
        return {
            url: rec.url, domain: rec.domain, title: rec.pageTitle || rec.title, pageType: rec.pageType, summary: rec.pageSummary,
            warnings: rec.pageWarnings || [], publisher: rec.publisher, publishedDate: rec.publishedDate, otherClaims: rec.otherClaims || [],
            mainClaim: rec.hasClaim ? rec.title : '', claimResult: rec.hasClaim ? rec : null
        };
    }

    const NEEDS_CORRECTION = ['false', 'partial', 'misleading'];

    function allLinksText(sources) {
        return sources.filter(s => s.url).map((s, i) => `${i + 1}. ${s.title}\n   ${s.url}`).join('\n');
    }

    // Shown for false / misleading / partly-true claims: what is actually true, or an honest "not found"
    function correctionHtml(result, claim, verdict, sources) {
        if (!NEEDS_CORRECTION.includes(verdict.key)) return '';
        const text = result.correction || '';
        const backing = sources.filter(s => s.backsCorrection && s.url);
        const proof = backing.length ? backing : sources.filter(s => s.stance === 'CONTRADICTS' && s.url).slice(0, 2);

        if (text) {
            return `
                <section class="fc-card fc-correct">
                    <h3><i class="fa-solid fa-circle-check"></i> The correct information</h3>
                    <p class="fc-lead">${window.esc(text)}</p>
                    ${proof.length ? `<div class="fc-based-on"><span>Based on:</span>${proof.map(s => `<a href="${window.esc(s.url)}" target="_blank" rel="noopener noreferrer">${window.esc(s.name || s.title)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`).join('')}</div>` : ''}
                </section>`;
        }

        const q = encodeURIComponent(claim.slice(0, 200));
        return `
            <section class="fc-card fc-correct none">
                <h3><i class="fa-solid fa-magnifying-glass"></i> The correct information</h3>
                <p class="fc-body-text">We could not find a reliable statement of what is actually true in the sources we searched, so we are not going to guess. You can look for the correct news yourself:</p>
                <div class="fc-find">
                    <a class="btn btn-sm btn-outline-secondary" href="https://news.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer"><i class="fa-regular fa-newspaper"></i> Latest news on this</a>
                    <a class="btn btn-sm btn-outline-secondary" href="https://toolbox.google.com/factcheck/explorer/search/${q}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-shield-halved"></i> Published fact-checks</a>
                </div>
            </section>`;
    }

    function linksHtml(sources) {
        const linked = sources.filter(s => s.url);
        if (!linked.length) return '';
        const order = { CONTRADICTS: 0, SUPPORTS: 1, CONTEXT: 2 };
        const list = [...linked].sort((a, b) => order[a.stance] - order[b.stance]);
        return `
            <section class="fc-card" id="fc-links">
                <div class="fc-card-head">
                    <h3><i class="fa-solid fa-link"></i> All source links (${list.length})</h3>
                    <button class="btn btn-sm btn-outline-secondary mb-3" data-action="copy-links"><i class="fa-regular fa-copy"></i> Copy all links</button>
                </div>
                <ol class="fc-links">
                    ${list.map(s => {
                        const st = STANCE[s.stance];
                        const where = [s.name, s.domain && s.domain !== 'news.google.com' ? s.domain : ''].filter(Boolean).map(window.esc).join(' · ');
                        return `<li>
                            <span class="fc-link-dot ${st.cls}" title="${st.label}"></span>
                            <div class="fc-link-main">
                                <a href="${window.esc(s.url)}" target="_blank" rel="noopener noreferrer">${window.esc(s.title)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                                <span>${where ? where + ' · ' : ''}${st.label}</span>
                            </div>
                        </li>`;
                    }).join('')}
                </ol>
                <p class="fc-link-note"><i class="fa-solid fa-circle-info"></i> News links open through Google News and then redirect to the publisher's site.</p>
            </section>`;
    }

    function summaryText(result, claim) {
        const v = window.getVerdict(result.verdict || result.status);
        const conf = confidenceOf(result);
        const sources = normalizeSources(result.sources).filter(s => s.stance !== 'CONTEXT' && s.url).slice(0, 5);
        return [
            'Fact check by Kalki-Kit',
            `Claim: "${claim}"`,
            `Verdict: ${v.label}${conf != null && hasScore(v) ? ` (${conf}% confidence)` : ''}`,
            ...(result.correction ? [`Correct information: ${result.correction}`] : []),
            `What the evidence shows: ${result.correctInfo || result.why || ''}`,
            ...(sources.length ? ['Sources:', ...sources.map(s => `- ${s.name || s.title}: ${s.url}`)] : []),
            `Checked on ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. AI-assisted: read the sources before sharing.`
        ].join('\n');
    }

    // Copy and share actions are the same wherever a claim result is shown. Returns true when handled.
    async function handleResultAction(action, result, claim) {
        if (!result) return false;
        if (action === 'copy-links' || action === 'copy') {
            const text = action === 'copy' ? summaryText(result, claim) : allLinksText(normalizeSources(result.sources));
            try {
                await navigator.clipboard.writeText(text);
                window.showKalkiToast(action === 'copy' ? 'Copied' : 'Links copied', action === 'copy' ? 'The summary is ready to paste.' : 'All source links are ready to paste.', 'success');
            } catch (err) {
                window.showKalkiToast('Could not copy', 'Your browser blocked clipboard access.', 'warning');
            }
            return true;
        }
        if (action === 'share') {
            const v = window.getVerdict(result.verdict || result.status);
            window.generateFactPoster({
                claim,
                verdictLabel: v.label,
                verdictKey: v.key,
                confidence: hasScore(v) ? confidenceOf(result) : null,
                correction: result.correction || '',
                reality: result.correctInfo || result.why || '',
                sources: normalizeSources(result.sources).filter(s => s.stance !== 'CONTEXT').slice(0, 3)
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('posterModal')).show();
            return true;
        }
        return false;
    }

    // ----------------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------------
    function sourceCard(s) {
        const st = STANCE[s.stance];
        const meta = [s.name, s.date].filter(Boolean).map(window.esc).join(' · ');
        const title = s.url
            ? `<a class="fc-source-title" href="${window.esc(s.url)}" target="_blank" rel="noopener noreferrer">${window.esc(s.title)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
            : `<span class="fc-source-title">${window.esc(s.title)}</span>`;
        return `
            <article class="fc-source stance-${st.cls}">
                <div class="fc-source-head">
                    <span class="fc-stance ${st.cls}"><i class="fa-solid ${st.icon}"></i> ${st.label}</span>
                    ${s.type ? `<span class="fc-source-type">${window.esc(s.type)}</span>` : ''}
                    ${s.trust != null ? `<span class="fc-trust" title="How reliable this kind of source usually is">Reliability ${s.trust}/100</span>` : ''}
                </div>
                ${title}
                ${meta ? `<div class="fc-source-meta">${meta}</div>` : ''}
                ${s.note && s.note !== s.title ? `<p class="fc-source-note">${window.esc(s.note)}</p>` : ''}
            </article>`;
    }

    // opts: eyebrow (label above the claim), echo (show the claim), actions (show the button row)
    function resultHtml(result, claim, fromHistory, opts = {}) {
        const { eyebrow = fromHistory ? 'Saved check' : 'You checked', echo = true, actions = true } = opts;
        const verdict = window.getVerdict(result.verdict || result.status);
        // "Can't verify" has no meaningful percentage: showing one only invites a wrong reading
        const conf = hasScore(verdict) ? confidenceOf(result) : null;
        const sources = normalizeSources(result.sources);
        const direct = sources.filter(s => s.stance !== 'CONTEXT');
        const related = sources.filter(s => s.stance === 'CONTEXT');
        const nSupport = sources.filter(s => s.stance === 'SUPPORTS').length;
        const nContra = sources.filter(s => s.stance === 'CONTRADICTS').length;

        const why = result.why || result.explanation || '';
        const reality = result.correctInfo || '';
        const rows = (Array.isArray(result.claimVsFact) ? result.claimVsFact : []).filter(r => r && (r.claimPoint || r.empiricalFact));
        const showTable = rows.length > 1; // a single row would only repeat the summary above
        const queries = Array.isArray(result.searchQueries) ? result.searchQueries : [];

        const rowStatus = { Confirmed: 'supports', Refuted: 'contradicts', Clarified: 'context', Unverified: 'muted' };

        return `
            <div class="fc-result fade-in" ${opts.id === false ? '' : 'id="fc-result" tabindex="-1"'}>
                ${echo ? `
                <div class="fc-claim-echo">
                    <span class="fc-eyebrow">${window.esc(eyebrow)}</span>
                    <p>“${window.esc(claim)}”</p>
                </div>` : ''}

                ${result.warning ? `<div class="fc-alert warn" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><div>${window.esc(result.warning)}</div></div>` : ''}

                <section class="fc-verdict is-${verdict.key}" aria-labelledby="fc-verdict-label">
                    <div class="fc-verdict-icon" aria-hidden="true"><i class="fa-solid ${verdict.icon}"></i></div>
                    <div class="fc-verdict-body">
                        <span class="fc-eyebrow">Verdict</span>
                        <h2 id="fc-verdict-label">${verdict.label}</h2>
                        <p>${verdict.meaning}</p>
                    </div>
                    ${conf != null ? `
                    <div class="fc-meter" role="img" aria-label="Confidence ${conf} percent">
                        <div class="fc-meter-top"><span>Confidence</span><strong>${conf}%</strong></div>
                        <div class="fc-meter-bar"><span style="width:${conf}%"></span></div>
                    </div>` : ''}
                </section>

                ${result.confidenceNote ? `<p class="fc-opinion"><i class="fa-solid fa-circle-info"></i> ${window.esc(result.confidenceNote)}</p>` : ''}

                ${correctionHtml(result, claim, verdict, sources)}

                ${(reality || why) ? `
                <section class="fc-card">
                    <h3><i class="fa-solid fa-lightbulb"></i> What the evidence shows</h3>
                    ${reality ? `<p class="fc-lead">${window.esc(reality)}</p>` : ''}
                    ${why && why !== reality ? `<p class="fc-body-text">${window.esc(why)}</p>` : ''}
                </section>` : ''}

                ${showTable ? `
                <section class="fc-card">
                    <h3><i class="fa-solid fa-code-compare"></i> Claim, point by point</h3>
                    <div class="table-responsive">
                        <table class="table fc-table">
                            <thead><tr><th>Part of the claim</th><th>What the evidence shows</th><th>Result</th></tr></thead>
                            <tbody>
                                ${rows.map(r => `
                                    <tr>
                                        <td data-label="Part of the claim">${window.esc(r.claimPoint)}</td>
                                        <td data-label="What the evidence shows">${window.esc(r.empiricalFact)}</td>
                                        <td data-label="Result"><span class="fc-pill ${rowStatus[r.status] || 'muted'}">${window.esc(r.status || 'Unverified')}</span></td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>` : ''}

                <section class="fc-card">
                    <div class="fc-card-head">
                        <h3><i class="fa-solid fa-book-open"></i> Sources</h3>
                        <div class="fc-counts">
                            ${nContra ? `<span class="fc-pill contradicts">${nContra} contradict</span>` : ''}
                            ${nSupport ? `<span class="fc-pill supports">${nSupport} support</span>` : ''}
                            ${related.length ? `<span class="fc-pill muted">${related.length} related</span>` : ''}
                        </div>
                    </div>
                    ${direct.length ? `<div class="fc-source-list">${direct.map(sourceCard).join('')}</div>` : `
                        <div class="fc-empty-inline"><i class="fa-solid fa-circle-info"></i> No source directly confirmed or contradicted this claim.</div>`}
                    ${related.length ? `
                    <details class="fc-details">
                        <summary>Show ${related.length} related ${related.length === 1 ? 'article' : 'articles'}</summary>
                        <div class="fc-source-list mt-2">${related.map(sourceCard).join('')}</div>
                    </details>` : ''}
                </section>

                ${linksHtml(sources)}

                <details class="fc-details fc-card">
                    <summary><i class="fa-solid fa-gears"></i> How this was checked</summary>
                    <div class="fc-how">
                        ${queries.length ? `<p><strong>Searches run:</strong></p><ul>${queries.map(q => `<li>${window.esc(q)}</li>`).join('')}</ul>` : ''}
                        <p><strong>Sources reviewed:</strong> ${sources.length}${result.cached ? ' <span class="text-muted">(result from a recent identical check)</span>' : ''}</p>
                        ${result.engine || result.aiEngineAttribution ? `<p class="mb-0 text-muted small">${window.esc(result.engine || result.aiEngineAttribution)}</p>` : ''}
                    </div>
                </details>

                ${actions ? `
                <div class="fc-actions">
                    <button class="btn btn-outline-secondary" data-action="copy"><i class="fa-regular fa-copy"></i> Copy summary</button>
                    <button class="btn btn-outline-secondary" data-action="share"><i class="fa-solid fa-image"></i> Share as image</button>
                    <button class="btn btn-primary ms-sm-auto" data-action="again"><i class="fa-solid fa-rotate-right"></i> Check another</button>
                </div>
                <p class="fc-disclaimer"><i class="fa-solid fa-circle-info"></i> AI-assisted result. For anything important, open the sources above and read them yourself.</p>` : ''}
            </div>`;
    }

    // What we learned about the page behind a link, shown above the claim result
    function linkCardHtml(link) {
        const type = PAGE_TYPES[link.pageType] || PAGE_TYPES.OTHER;
        const when = link.publishedDate ? new Date(link.publishedDate) : null;
        const whenText = when && !isNaN(when) ? when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const url = window.safeUrl(link.url);
        const warnings = link.warnings || [];
        const rating = link.publisher
            ? `${window.esc(link.publisher.type)} · reliability ${link.publisher.score}/100`
            : 'This publisher is not on our list of rated sources, so we have not scored it. Judge it by the evidence below.';
        return `
            <section class="fc-card fc-article fade-in">
                <h3><i class="fa-regular fa-newspaper"></i> The page you shared</h3>
                ${url ? `<a class="fc-article-title" href="${window.esc(url)}" target="_blank" rel="noopener noreferrer">${window.esc(link.title)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : `<span class="fc-article-title">${window.esc(link.title)}</span>`}
                <div class="fc-article-meta">
                    <span>${window.esc(link.domain)}</span>
                    ${whenText ? `<span>${whenText}</span>` : ''}
                    <span class="fc-pill ${link.pageType === 'SATIRE' ? 'contradicts' : 'muted'}">${type}</span>
                </div>
                ${link.summary ? `<p class="fc-body-text mt-2">${window.esc(link.summary)}</p>` : ''}
                <p class="fc-publisher"><i class="fa-solid fa-building-columns"></i> ${rating}</p>
                ${link.pageType === 'SATIRE' ? '<div class="fc-alert warn mt-2 mb-0"><i class="fa-solid fa-masks-theater"></i><div>This page looks like satire, so its stories are not meant to be taken as real news.</div></div>' : ''}
                ${warnings.length ? `<ul class="fc-warnings">${warnings.map(w => `<li><i class="fa-solid fa-triangle-exclamation"></i>${window.esc(w)}</li>`).join('')}</ul>` : ''}
            </section>`;
    }

    function otherClaimsHtml(link) {
        const claims = link.otherClaims || [];
        if (!claims.length) return '';
        return `
            <section class="fc-card">
                <h3><i class="fa-solid fa-list-check"></i> Other claims in this article</h3>
                <p class="fc-body-text mb-2">We checked the main claim above. Tap one to check another.</p>
                <div class="fc-other-claims">
                    ${claims.map(c => `<button type="button" class="fc-other" data-claim-check="${window.esc(c)}"><i class="fa-solid fa-magnifying-glass"></i><span>${window.esc(c)}</span></button>`).join('')}
                </div>
            </section>`;
    }

    function recentHtml() {
        const items = (window.KalkiData ? window.KalkiData.getClaims() : []).slice(0, 5);
        if (!items.length) return '';
        return `
            <section class="fc-recent" aria-labelledby="fc-recent-title">
                <div class="fc-card-head">
                    <h3 id="fc-recent-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent checks</h3>
                    <button class="btn btn-sm btn-link" data-action="history">See all</button>
                </div>
                <ul class="fc-recent-list">
                    ${items.map(c => {
                        const v = window.getVerdict(c.status || c.verdict);
                        const lead = c.kind === 'image' && c.thumb
                            ? `<img class="fc-thumb" src="${window.esc(c.thumb)}" alt="">`
                            : `<span class="fc-dot is-${v.key}" title="${v.label}"><i class="fa-solid ${v.icon}"></i></span>`;
                        const tag = c.kind === 'image' ? 'Image · ' : c.kind === 'link' ? 'Link · ' : '';
                        return `
                        <li>
                            <button type="button" class="fc-recent-item" data-open="${window.esc(c.id)}">
                                ${lead}
                                <span class="fc-recent-text">${window.esc(c.title || c.extractedClaim || '')}</span>
                                <span class="fc-recent-meta">${tag}<b class="is-${v.key}">${v.label}</b> · ${window.esc(window.formatTimeAgo(c.timestamp))}</span>
                            </button>
                        </li>`;
                    }).join('')}
                </ul>
            </section>`;
    }

    // ----------------------------------------------------------------------
    // Voice input (only offered where the browser supports it)
    // ----------------------------------------------------------------------
    function setupVoice(page, input, onChange) {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const wrap = page.querySelector('#fc-voice');
        if (!Recognition || !wrap) return;
        wrap.hidden = false;

        const btn = wrap.querySelector('#btn-voice');
        const lang = wrap.querySelector('#voice-lang');
        try { lang.value = localStorage.getItem('kalki_voice_lang') || 'en-IN'; } catch (e) { /* storage blocked */ }
        lang.addEventListener('change', () => { try { localStorage.setItem('kalki_voice_lang', lang.value); } catch (e) { /* storage blocked */ } });

        let rec = null;
        const paint = on => {
            btn.classList.toggle('listening', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.querySelector('span').textContent = on ? ' Listening… tap to stop' : ' Speak';
        };

        btn.addEventListener('click', () => {
            if (rec) { rec.stop(); return; }
            rec = new Recognition();
            rec.lang = lang.value;
            rec.interimResults = true;
            rec.continuous = false;
            const base = input.value.trim() ? input.value.trimEnd() + ' ' : '';
            rec.onresult = e => {
                let said = '';
                for (const r of e.results) said += r[0].transcript;
                input.value = (base + said).slice(0, MAX_LENGTH);
                onChange();
            };
            rec.onerror = e => {
                const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Allow microphone access in your browser to use voice input.'
                    : e.error === 'no-speech' ? 'We did not hear anything. Please try again.'
                    : e.error === 'network' ? 'Voice input needs an internet connection.' : '';
                if (msg) window.showKalkiToast('Voice input', msg, 'warning');
            };
            rec.onend = () => { rec = null; paint(false); };
            try { rec.start(); paint(true); } catch (e) { rec = null; paint(false); }
        });
    }

    // ----------------------------------------------------------------------
    // Page
    // ----------------------------------------------------------------------
    window.renderVerification = function (container) {
        container.innerHTML = `
            <div class="fc-page fade-in">
                <section class="fc-hero">
                    <h1>Is it true? <span class="text-gradient">Check it.</span></h1>
                    <p class="fc-sub">Paste a headline, a forwarded message or a news link. We search live news, fact-checkers and Wikipedia, then show you what the evidence says.</p>

                    <div class="fc-modes" role="tablist" aria-label="What do you want to check?">
                        <button type="button" role="tab" class="fc-mode" data-mode="claim"><i class="fa-solid fa-align-left"></i> Claim or message</button>
                        <button type="button" role="tab" class="fc-mode" data-mode="link"><i class="fa-solid fa-link"></i> News link</button>
                    </div>

                    <form id="fc-form" novalidate>
                        <div id="fc-claim-box">
                            <label for="claim-text-input" class="visually-hidden">News claim to check</label>
                            <textarea id="claim-text-input" class="form-control fc-input" rows="4" maxlength="${MAX_LENGTH}"
                                placeholder="Example: The government has banned ₹500 notes from next month"></textarea>
                            <div class="fc-input-foot">
                                <span class="fc-hint">Tip: check one claim at a time<span class="d-none d-md-inline"> · Ctrl+Enter to check</span></span>
                                <span class="fc-count text-nowrap" id="fc-count" aria-hidden="true">0 / ${MAX_LENGTH}</span>
                            </div>
                        </div>
                        <div id="fc-link-box" hidden>
                            <label for="link-input" class="visually-hidden">Link to a news article</label>
                            <input type="url" id="link-input" class="form-control form-control-lg fc-link-input" placeholder="https://www.example.com/news/article" autocomplete="off" inputmode="url" maxlength="2000">
                            <div class="fc-input-foot">
                                <span class="fc-hint">We read the article, find the main claim it makes and check that claim. Works with news articles; some sites that need a login cannot be read.</span>
                            </div>
                        </div>

                        <div class="fc-form-actions">
                            <button type="submit" class="btn btn-primary btn-lg" id="btn-verify"></button>
                            <button type="button" class="btn btn-outline-secondary btn-lg" id="btn-clear" hidden>Clear</button>
                            <div class="fc-voice" id="fc-voice" hidden>
                                <button type="button" class="btn btn-outline-secondary btn-lg" id="btn-voice" aria-pressed="false" title="Speak your claim instead of typing"><i class="fa-solid fa-microphone"></i><span> Speak</span></button>
                                <select id="voice-lang" class="form-select" aria-label="Language you will speak">
                                    ${VOICE_LANGS.map(([code, name]) => `<option value="${code}">${name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </form>

                    <div class="fc-examples" id="fc-examples">
                        <span>Try an example:</span>
                        ${EXAMPLES.map(e => `<button type="button" class="fc-chip" data-example="${window.esc(e)}">${window.esc(e)}</button>`).join('')}
                    </div>
                </section>

                <div id="fc-status" class="fc-status" role="status" aria-live="polite"></div>
                <div id="fc-output"></div>
                <div id="fc-recent-wrap">${recentHtml()}</div>
                <div id="fc-latest-wrap"></div>
            </div>`;

        const page = container.firstElementChild;
        const input = page.querySelector('#claim-text-input');
        const linkInput = page.querySelector('#link-input');
        const form = page.querySelector('#fc-form');
        const btn = page.querySelector('#btn-verify');
        const clearBtn = page.querySelector('#btn-clear');
        const count = page.querySelector('#fc-count');
        const status = page.querySelector('#fc-status');
        const output = page.querySelector('#fc-output');
        const recentWrap = page.querySelector('#fc-recent-wrap');

        const alive = () => page.isConnected;
        const submitLabel = () => session.mode === 'link'
            ? '<i class="fa-solid fa-magnifying-glass"></i> Check this link'
            : '<i class="fa-solid fa-magnifying-glass"></i> Check this claim';

        function syncInput() {
            session.draft = input.value;
            session.linkDraft = linkInput.value;
            count.textContent = `${input.value.length} / ${MAX_LENGTH}`;
            clearBtn.hidden = !input.value && !linkInput.value && !session.result && !session.link;
        }

        function setMode(mode) {
            session.mode = mode;
            page.querySelectorAll('.fc-mode').forEach(b => {
                const on = b.dataset.mode === mode;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', String(on));
            });
            page.querySelector('#fc-claim-box').hidden = mode !== 'claim';
            page.querySelector('#fc-link-box').hidden = mode !== 'link';
            page.querySelector('#fc-examples').hidden = mode !== 'claim';
            const voice = page.querySelector('#fc-voice');
            if (voice && (window.SpeechRecognition || window.webkitSpeechRecognition)) voice.hidden = mode !== 'claim';
            if (!running) btn.innerHTML = submitLabel();
        }

        function setBusy(on) {
            btn.disabled = on;
            input.readOnly = on;
            linkInput.readOnly = on;
            page.querySelectorAll('[data-example],[data-claim-check],.fc-mode').forEach(b => { b.disabled = on; });
            btn.innerHTML = on ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking…' : submitLabel();
            output.setAttribute('aria-busy', String(on));
        }

        function showError(message, canRetry) {
            status.innerHTML = `
                <div class="fc-alert error" role="alert">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <div>${window.esc(message)}</div>
                    ${canRetry ? '<button type="button" class="btn btn-sm btn-outline-danger ms-auto" data-action="retry">Try again</button>' : ''}
                </div>`;
        }

        function draw() {
            if (session.link) {
                const link = session.link;
                const noClaim = !link.claimResult;
                output.innerHTML = linkCardHtml(link)
                    + (noClaim
                        ? `<div class="fc-alert info" id="fc-result" tabindex="-1"><i class="fa-solid fa-circle-info"></i><div>${link.mainClaim ? 'We found a claim in this article but could not complete the check. Please try again.' : 'We could not find a checkable factual claim on this page. It may be opinion, entertainment or an explainer. If you want a specific statement checked, paste it in the Claim tab.'}</div></div>`
                        : resultHtml(link.claimResult, link.mainClaim, session.fromHistory, { eyebrow: 'Main claim in this article' }))
                    + otherClaimsHtml(link);
            } else {
                output.innerHTML = resultHtml(session.result, session.claim, session.fromHistory);
            }
        }

        function showResult(scroll = true) {
            status.innerHTML = '';
            draw();
            clearBtn.hidden = false;
            recentWrap.innerHTML = recentHtml();
            const el = output.querySelector('#fc-result');
            if (el && scroll) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.focus({ preventScroll: true });
            }
        }

        function resetForm() {
            session.result = null;
            session.link = null;
            session.claim = '';
            session.draft = '';
            session.linkDraft = '';
            input.value = '';
            linkInput.value = '';
            status.innerHTML = '';
            output.innerHTML = '';
            syncInput();
            (session.mode === 'link' ? linkInput : input).focus();
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // One runner for both kinds of check
        async function run(mode, value) {
            if (running) return;
            let body, endpoint, progress;

            if (mode === 'link') {
                const link = String(value || '').trim();
                if (!/^https?:\/\/\S{4,}$/i.test(link)) {
                    showError('Please paste a full web link that starts with http:// or https://', false);
                    linkInput.focus();
                    return;
                }
                endpoint = '/api/verify-link';
                body = { url: link };
                progress = ['Reading the article, finding its main claim, then checking it…', 'Still working. Reading pages and searching can take a little while…', 'Almost there. Busy periods can take up to a minute…'];
            } else {
                const claim = String(value || '').replace(/\s+/g, ' ').trim();
                if (claim.length < MIN_LENGTH) {
                    showError('Please enter a full sentence or headline (at least a few words) so there is something to check.', false);
                    input.focus();
                    return;
                }
                endpoint = '/api/verify';
                body = { claim };
                progress = ['Searching news, fact-checkers and Wikipedia, then reading the evidence…', 'Still working. The AI service is a little busy, so this is taking longer than usual…', 'Almost there. Busy periods can take up to a minute…'];
            }

            session.result = null;
            session.link = null;
            output.innerHTML = '';
            setBusy(true);

            const startedAt = Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort('timeout'), CLIENT_TIMEOUT_MS);
            const ticker = setInterval(() => {
                if (!alive()) return;
                const secs = Math.round((Date.now() - startedAt) / 1000);
                const el = status.querySelector('[data-progress-text]');
                if (el) el.textContent = secs < 12 ? progress[0] : secs < 30 ? progress[1] : progress[2];
                const t = status.querySelector('[data-progress-time]');
                if (t) t.textContent = `${secs}s`;
            }, 1000);
            running = { controller };

            status.innerHTML = `
                <div class="fc-progress">
                    <div class="spinner-border text-primary" aria-hidden="true"></div>
                    <div class="fc-progress-text">
                        <strong>${mode === 'link' ? 'Checking your link' : 'Checking your claim'}</strong>
                        <span data-progress-text>${progress[0]}</span>
                    </div>
                    <span class="fc-progress-time" data-progress-time>0s</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel">Cancel</button>
                </div>`;

            try {
                const res = await window.authFetch(`${window.getBackendBase()}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    const fallback = res.status === 429 ? 'Too many checks in a short time. Please wait a few minutes.'
                        : res.status === 401 ? 'Your session expired. Please sign in again.'
                        : 'Something went wrong while checking this. Please try again.';
                    throw Object.assign(new Error(err.error || fallback), { handled: true });
                }

                const result = await res.json();
                let label;
                if (mode === 'link') {
                    session.link = result;
                    session.result = result.claimResult;
                    session.claim = result.mainClaim || '';
                    session.fromHistory = false;
                    if (!(result.claimResult && result.claimResult.warning)) window.KalkiData.addClaim(toLinkRecord(result));
                    label = `${result.domain}: ${result.claimResult ? window.getVerdict(result.claimResult.verdict).label : 'no claim found'}`;
                } else {
                    session.result = result;
                    session.claim = body.claim;
                    session.fromHistory = false;
                    if (!result.warning) window.KalkiData.addClaim(toRecord(result, body.claim));
                    label = `${window.getVerdict(result.verdict).label}: ${body.claim}`;
                }

                if (alive()) showResult();
                else if (window.showKalkiToast) window.showKalkiToast('Check finished', label, 'success');
            } catch (err) {
                if (!alive()) return;
                if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
                    status.innerHTML = '<div class="fc-alert info"><i class="fa-solid fa-ban"></i><div>Check cancelled.</div></div>';
                } else if (controller.signal.reason === 'timeout') {
                    showError('This is taking too long. The services we rely on may be busy. Please try again in a moment.', true);
                } else if (err.handled) {
                    showError(err.message, mode === 'claim' || !/not allowed|valid web link|not a web page|could not read|refused/i.test(err.message));
                } else {
                    showError('Could not reach the fact-check server. Check that it is running and your internet connection is working, then try again.', true);
                }
            } finally {
                clearTimeout(timeout);
                clearInterval(ticker);
                running = null;
                if (alive()) setBusy(false);
            }
        }

        const runCurrent = () => run(session.mode, session.mode === 'link' ? linkInput.value : input.value);

        // Events
        form.addEventListener('submit', e => { e.preventDefault(); runCurrent(); });
        input.addEventListener('input', syncInput);
        linkInput.addEventListener('input', syncInput);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCurrent(); }
        });
        clearBtn.addEventListener('click', resetForm);

        page.addEventListener('click', async e => {
            const target = e.target.closest('[data-example],[data-open],[data-action],[data-mode],[data-claim-check]');
            if (!target) return;

            if (target.dataset.mode) {
                setMode(target.dataset.mode);
                (target.dataset.mode === 'link' ? linkInput : input).focus();
            } else if (target.dataset.example || target.dataset.claimCheck) {
                const text = target.dataset.example || target.dataset.claimCheck;
                setMode('claim');
                input.value = text;
                syncInput();
                run('claim', text);
            } else if (target.dataset.open) {
                const rec = window.KalkiData.getClaims().find(c => c.id === target.dataset.open);
                if (!rec) return;
                if (rec.kind === 'image') { window.showStoredImage(rec.id); return; }
                window.showStoredClaim(rec.id);
            } else {
                const action = target.dataset.action;
                if (action === 'cancel' && running) running.controller.abort('cancel');
                else if (action === 'retry') runCurrent();
                else if (action === 'again') resetForm();
                else if (action === 'history') window.loadKalkiModule('history');
                else await handleResultAction(action, session.result, session.claim);
            }
        });

        setupVoice(page, input, syncInput);

        // Restore what the user was looking at
        input.value = session.draft;
        linkInput.value = session.linkDraft;
        setMode(session.mode);
        syncInput();
        if (session.result || session.link) showResult();
        else if (!window.matchMedia('(pointer: coarse)').matches) (session.mode === 'link' ? linkInput : input).focus();

        if (window.loadLatestWidget) window.loadLatestWidget(page.querySelector('#fc-latest-wrap'), 4);
    };

    // Open a saved claim or link check from My Checks
    window.showStoredClaim = function (id) {
        const rec = window.KalkiData.getClaims().find(c => c.id === id);
        if (!rec) return;
        if (rec.kind === 'image') { window.showStoredImage(id); return; }
        session.fromHistory = true;
        if (rec.kind === 'link') {
            session.mode = 'link';
            session.linkDraft = rec.url || '';
            session.link = linkFromRecord(rec);
            session.result = session.link.claimResult;
            session.claim = session.link.mainClaim;
        } else {
            session.mode = 'claim';
            session.draft = rec.title || '';
            session.link = null;
            session.result = rec;
            session.claim = rec.title || '';
        }
        window.loadKalkiModule('verify');
    };

    // Used by "Check again" in My Checks and by the Image page
    window.prefillClaim = function (text, mode = 'claim') {
        session.mode = mode;
        if (mode === 'link') session.linkDraft = text || ''; else session.draft = text || '';
        session.result = null;
        session.link = null;
        session.claim = '';
        window.loadKalkiModule('verify');
    };

    // Shared with the Image Check page
    window.FC = { resultHtml, normalizeSources, confidenceOf, toRecord, handleResultAction, summaryText, STANCE };
})();
