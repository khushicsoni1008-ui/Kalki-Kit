// ==========================================================================
// KALKI-KIT MY CHECKS
// Searchable, filterable list of the claims this browser has checked.
// ==========================================================================

(function () {
    const PAGE_SIZES = [10, 25, 50];

    const FILTERS = [
        { id: 'all', label: 'All', match: () => true },
        { id: 'false', label: 'False', match: (v, c) => c.kind !== 'image' && v.key === 'false' },
        { id: 'true', label: 'Accurate', match: (v, c) => c.kind !== 'image' && v.key === 'true' },
        { id: 'mixed', label: 'Partly true / Misleading', match: (v, c) => c.kind !== 'image' && (v.key === 'partial' || v.key === 'misleading') },
        { id: 'unknown', label: "Can't verify", match: (v, c) => c.kind !== 'image' && (v.key === 'unverified' || v.key === 'ambiguous') },
        { id: 'image', label: 'Images', match: (v, c) => c.kind === 'image' },
        { id: 'link', label: 'Links', match: (v, c) => c.kind === 'link' }
    ];

    const view = { query: '', filter: 'all', page: 1, size: 10 };

    const claimText = c => c.title || c.extractedClaim || '';
    const verdictOf = c => window.getVerdict(c.status || c.verdict);

    function csvCell(value) {
        let v = String(value == null ? '' : value).replace(/\s+/g, ' ');
        // A cell that starts with = + - @ would run as a formula when opened in Excel
        if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
        return `"${v.replace(/"/g, '""')}"`;
    }

    function exportCsv(claims) {
        const rows = [['Type', 'Claim', 'Verdict', 'Confidence %', 'Category', 'Checked on', 'What the evidence shows']]
            .concat(claims.map(c => [
                c.kind === 'image' ? 'Image' : c.kind === 'link' ? 'Link' : 'Claim', claimText(c), verdictOf(c).label, c.confidence != null ? c.confidence : (c.aiConfidence || ''),
                c.category || '', c.timestamp ? new Date(c.timestamp).toISOString().slice(0, 10) : (c.date || ''),
                c.correctInfo || c.why || ''
            ]));
        const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kalki-kit-checks-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // Page numbers to show: first, last, and the pages around the current one, with gaps as ellipses
    function pageNumbers(current, total) {
        const keep = new Set([1, total, current - 1, current, current + 1]);
        const out = [];
        let prev = 0;
        for (let p = 1; p <= total; p++) {
            if (!keep.has(p)) continue;
            if (p - prev > 1) out.push('gap');
            out.push(p);
            prev = p;
        }
        return out;
    }

    function pagerHtml(total, from, to, pages) {
        const btn = (label, page, { disabled = false, active = false, aria = '' } = {}) =>
            `<button type="button" class="fc-page-btn${active ? ' active' : ''}" data-page="${page}" ${disabled ? 'disabled' : ''} ${active ? 'aria-current="page"' : ''} aria-label="${aria || 'Page ' + label}">${label}</button>`;
        return `
            <div class="fc-list-foot">
                <span class="fc-range">Showing ${from}–${to} of ${total}</span>
                <label class="fc-size">Per page
                    <select class="form-select form-select-sm" data-size aria-label="Checks per page">
                        ${PAGE_SIZES.map(n => `<option value="${n}" ${n === view.size ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </label>
                ${pages > 1 ? `
                <nav class="fc-pager" aria-label="Pages">
                    ${btn('<i class="fa-solid fa-chevron-left"></i>', view.page - 1, { disabled: view.page === 1, aria: 'Previous page' })}
                    ${pageNumbers(view.page, pages).map(p => p === 'gap' ? '<span class="fc-page-gap">…</span>' : btn(p, p, { active: p === view.page })).join('')}
                    ${btn('<i class="fa-solid fa-chevron-right"></i>', view.page + 1, { disabled: view.page === pages, aria: 'Next page' })}
                </nav>` : ''}
            </div>`;
    }

    function listHtml(all) {
        const f = FILTERS.find(x => x.id === view.filter) || FILTERS[0];
        const q = view.query.trim().toLowerCase();
        const matches = all.filter(c => f.match(verdictOf(c), c) &&
            (!q || `${claimText(c)} ${c.why || ''} ${c.correctInfo || ''} ${c.category || ''}`.toLowerCase().includes(q)));

        if (!all.length) {
            return `
                <div class="fc-empty">
                    <i class="fa-regular fa-folder-open"></i>
                    <h3>No checks yet</h3>
                    <p>Every claim you check is saved here, in this browser only.</p>
                    <button class="btn btn-primary" data-action="new"><i class="fa-solid fa-magnifying-glass"></i> Check your first claim</button>
                </div>`;
        }
        if (!matches.length) {
            return `
                <div class="fc-empty">
                    <i class="fa-solid fa-filter-circle-xmark"></i>
                    <h3>Nothing matches</h3>
                    <p>Try a different word, or show all checks.</p>
                    <button class="btn btn-outline-secondary" data-action="reset-filters">Show all checks</button>
                </div>`;
        }

        const pages = Math.max(1, Math.ceil(matches.length / view.size));
        view.page = Math.min(Math.max(1, view.page), pages); // stay in range after deleting or filtering
        const start = (view.page - 1) * view.size;
        const shown = matches.slice(start, start + view.size);
        return `
            <ul class="fc-history-list">
                ${shown.map(c => {
                    const v = verdictOf(c);
                    const isImage = c.kind === 'image';
                    const conf = c.confidence != null ? c.confidence : c.aiConfidence;
                    const summary = (isImage ? c.why : (c.correction || c.correctInfo || c.why)) || '';
                    return `
                    <li class="fc-history-item">
                        ${isImage && c.thumb
                            ? `<img class="fc-thumb lg" src="${window.esc(c.thumb)}" alt="">`
                            : `<span class="fc-dot is-${v.key}" aria-hidden="true"><i class="fa-solid ${v.icon}"></i></span>`}
                        <div class="fc-history-main">
                            <div class="fc-history-claim">${window.esc(claimText(c))}</div>
                            ${summary ? `<div class="fc-history-sum">${window.esc(summary)}</div>` : ''}
                            <div class="fc-history-meta">
                                ${isImage ? '<span class="fc-kind"><i class="fa-regular fa-image"></i> Image</span>' : c.kind === 'link' ? `<span class="fc-kind"><i class="fa-solid fa-link"></i> ${window.esc(c.domain || 'Link')}</span>` : ''}
                                <b class="is-${v.key}">${v.label}</b>
                                ${conf != null && conf !== '' && !['unverified', 'ambiguous'].includes(v.key) ? `<span>${window.esc(conf)}% confidence</span>` : ''}
                                ${c.category ? `<span>${window.esc(c.category)}</span>` : ''}
                                <span>${window.esc(window.formatTimeAgo(c.timestamp) || c.date || '')}</span>
                            </div>
                        </div>
                        <div class="fc-history-actions">
                            <button class="btn btn-sm btn-outline-secondary" data-view="${window.esc(c.id)}" aria-label="View result"><i class="fa-regular fa-eye"></i><span class="d-none d-md-inline"> View</span></button>
                            ${isImage ? '' : `<button class="btn btn-sm btn-outline-secondary" data-recheck="${window.esc(c.id)}" aria-label="Check again" title="Check again with the latest news"><i class="fa-solid fa-rotate-right"></i></button>`}
                            <button class="btn btn-sm btn-outline-danger" data-delete="${window.esc(c.id)}" aria-label="Delete this check" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                        </div>
                    </li>`;
                }).join('')}
            </ul>
            ${pagerHtml(matches.length, start + 1, start + shown.length, pages)}`;
    }

    window.renderClaims = function (container) {
        const all = [...window.KalkiData.getClaims()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const count = key => all.filter(c => c.kind !== 'image' && verdictOf(c).key === key).length;
        const stats = [
            { label: 'Checked', value: all.length, cls: 'primary' },
            { label: 'False', value: count('false'), cls: 'false' },
            { label: 'Accurate', value: count('true'), cls: 'true' },
            { label: 'Partly true / Misleading', value: count('partial') + count('misleading'), cls: 'partial' },
            { label: "Can't verify", value: all.filter(c => c.kind !== 'image' && ['unverified', 'ambiguous'].includes(verdictOf(c).key)).length, cls: 'unverified' },
            { label: 'Images', value: all.filter(c => c.kind === 'image').length, cls: 'clean' }
        ];

        container.innerHTML = `
            <div class="fc-page fade-in">
                <div class="fc-page-head">
                    <div>
                        <h1>My Checks</h1>
                        <p class="text-muted mb-0">Claims you have checked. Saved in this browser only.</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-primary" data-action="new"><i class="fa-solid fa-plus"></i> New check</button>
                        <button class="btn btn-outline-secondary" data-action="export" ${all.length ? '' : 'disabled'}><i class="fa-solid fa-file-arrow-down"></i> Export CSV</button>
                        <button class="btn btn-outline-danger" data-action="clear" ${all.length ? '' : 'disabled'}><i class="fa-regular fa-trash-can"></i> Clear all</button>
                    </div>
                </div>

                ${all.length ? `
                <div class="fc-stats">
                    ${stats.map(s => `<div class="fc-stat is-${s.cls}"><strong>${s.value}</strong><span>${s.label}</span></div>`).join('')}
                </div>

                <div class="fc-toolbar">
                    <div class="fc-search">
                        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <label for="history-search" class="visually-hidden">Search your checks</label>
                        <input type="search" id="history-search" class="form-control" placeholder="Search your checks" value="${window.esc(view.query)}" autocomplete="off">
                    </div>
                    <div class="fc-filters" role="group" aria-label="Filter by verdict">
                        ${FILTERS.map(f => `<button type="button" class="fc-chip ${f.id === view.filter ? 'active' : ''}" data-filter="${f.id}" aria-pressed="${f.id === view.filter}">${f.label}</button>`).join('')}
                    </div>
                </div>` : ''}

                <div id="history-list">${listHtml(all)}</div>
            </div>`;

        const page = container.firstElementChild;
        const listEl = page.querySelector('#history-list');
        const redraw = () => { listEl.innerHTML = listHtml(all); };

        page.querySelector('#history-search')?.addEventListener('input', e => {
            view.query = e.target.value;
            view.page = 1;
            redraw();
        });

        page.addEventListener('change', e => {
            if (e.target.matches('[data-size]')) {
                view.size = Number(e.target.value) || 10;
                view.page = 1;
                redraw();
            }
        });

        page.addEventListener('click', e => {
            const t = e.target.closest('[data-filter],[data-view],[data-recheck],[data-delete],[data-action],[data-page]');
            if (!t) return;

            if (t.dataset.page) {
                view.page = Number(t.dataset.page);
                redraw();
                listEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
                return;
            }

            if (t.dataset.filter) {
                view.filter = t.dataset.filter;
                view.page = 1;
                page.querySelectorAll('[data-filter]').forEach(b => {
                    const on = b.dataset.filter === view.filter;
                    b.classList.toggle('active', on);
                    b.setAttribute('aria-pressed', String(on));
                });
                redraw();
            } else if (t.dataset.view) {
                window.showStoredClaim(t.dataset.view);
            } else if (t.dataset.recheck) {
                const rec = all.find(c => c.id === t.dataset.recheck);
                if (rec) rec.kind === 'link' ? window.prefillClaim(rec.url || claimText(rec), 'link') : window.prefillClaim(claimText(rec));
            } else if (t.dataset.delete) {
                if (confirm('Delete this check from your history?')) {
                    window.KalkiData.deleteClaim(t.dataset.delete);
                    window.renderClaims(container);
                }
            } else {
                const action = t.dataset.action;
                if (action === 'new') window.loadKalkiModule('verify');
                else if (action === 'reset-filters') {
                    view.query = ''; view.filter = 'all'; view.page = 1;
                    window.renderClaims(container);
                } else if (action === 'export') exportCsv(all);
                else if (action === 'clear' && confirm('Delete all saved checks? This cannot be undone.')) {
                    window.KalkiData.clearAllClaims();
                    window.renderClaims(container);
                }
            }
        });
    };
})();
