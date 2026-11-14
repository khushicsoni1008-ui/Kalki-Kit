// ==========================================================================
// KALKI-KIT LATEST FACT-CHECKS
// What Alt News, BOOM, Factly and Vishvas News published most recently, so
// people can see what is being debunked right now. Items link straight to the
// fact-checker's own page.
// ==========================================================================

(function () {
    let cache = { at: 0, items: [] };
    let pending = null;

    // One shared request, reused for 5 minutes by the page and the home-page strip
    function loadItems(force = false) {
        if (!force && cache.items.length && Date.now() - cache.at < 5 * 60 * 1000) return Promise.resolve(cache.items);
        if (pending) return pending;
        pending = window.authFetch(`${window.getBackendBase()}/api/latest-factchecks`)
            .then(async res => {
                if (!res.ok) throw new Error('feed');
                const data = await res.json();
                cache = { at: Date.now(), items: Array.isArray(data.items) ? data.items : [] };
                return cache.items;
            })
            .finally(() => { pending = null; });
        return pending;
    }

    const safeItems = items => items.map(i => ({ ...i, url: window.safeUrl(i.url) })).filter(i => i.url && i.title);

    function cardHtml(i) {
        return `
            <article class="fc-feed-item">
                <div class="fc-feed-head">
                    <span class="fc-pill context">${window.esc(i.publisher)}</span>
                    ${i.date ? `<span class="fc-feed-date">${window.esc(i.date)}</span>` : ''}
                </div>
                <a class="fc-feed-title" href="${window.esc(i.url)}" target="_blank" rel="noopener noreferrer">${window.esc(i.title)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                ${i.summary ? `<p class="fc-feed-sum">${window.esc(i.summary)}</p>` : ''}
            </article>`;
    }

    function skeleton(n) {
        return Array.from({ length: n }, () => '<div class="fc-feed-item fc-skel"><i></i><i></i><i></i></div>').join('');
    }

    // Full page
    window.renderLatest = function (container) {
        container.innerHTML = `
            <div class="fc-page fade-in">
                <div class="fc-page-head">
                    <div>
                        <h1>Latest Fact-Checks</h1>
                        <p class="text-muted mb-0">What trusted fact-checking sites have debunked or confirmed most recently. Each item opens on the fact-checker's own site.</p>
                    </div>
                    <button class="btn btn-outline-secondary" id="feed-refresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
                </div>
                <div class="fc-filters mb-3" id="feed-filters" role="group" aria-label="Filter by fact-checker" hidden></div>
                <div class="fc-feed" id="feed-list" aria-live="polite">${skeleton(5)}</div>
                <p class="fc-link-note mt-3"><i class="fa-solid fa-circle-info"></i> Headlines are shown as the fact-checkers wrote them, some in Hindi or Telugu. Want one of these claims checked here? Copy it into the Fact Check page.</p>
            </div>`;

        const page = container.firstElementChild;
        const list = page.querySelector('#feed-list');
        const filters = page.querySelector('#feed-filters');
        let items = [];
        let active = 'all';

        const draw = () => {
            const shown = active === 'all' ? items : items.filter(i => i.publisher === active);
            list.innerHTML = shown.length ? shown.map(cardHtml).join('') : '<div class="fc-empty-inline">Nothing to show for this fact-checker right now.</div>';
        };

        const load = async force => {
            list.innerHTML = skeleton(5);
            try {
                items = safeItems(await loadItems(force));
                if (!items.length) throw new Error('empty');
                const names = [...new Set(items.map(i => i.publisher))];
                filters.hidden = names.length < 2;
                filters.innerHTML = ['all', ...names].map(n => `<button type="button" class="fc-chip ${n === active ? 'active' : ''}" data-pub="${window.esc(n)}" aria-pressed="${n === active}">${n === 'all' ? 'All' : window.esc(n)}</button>`).join('');
                draw();
            } catch (err) {
                list.innerHTML = `
                    <div class="fc-alert error"><i class="fa-solid fa-circle-exclamation"></i><div>We could not load the latest fact-checks right now. Please try again in a moment.</div>
                    <button type="button" class="btn btn-sm btn-outline-danger ms-auto" id="feed-retry">Try again</button></div>`;
            }
        };

        page.addEventListener('click', e => {
            const pub = e.target.closest('[data-pub]');
            if (pub) {
                active = pub.dataset.pub;
                filters.querySelectorAll('[data-pub]').forEach(b => { const on = b.dataset.pub === active; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
                draw();
            } else if (e.target.closest('#feed-refresh, #feed-retry')) {
                load(true);
            }
        });
        load(false);
    };

    // Small strip for the Fact Check page: quiet if the feed cannot be loaded
    window.loadLatestWidget = async function (el, limit = 4) {
        if (!el) return;
        try {
            const items = safeItems(await loadItems(false)).slice(0, limit);
            if (!items.length || !el.isConnected) return;
            el.innerHTML = `
                <section class="fc-recent fc-latest" aria-labelledby="fc-latest-title">
                    <div class="fc-card-head">
                        <h3 id="fc-latest-title"><i class="fa-solid fa-bullhorn"></i> Fact-checkers are looking at</h3>
                        <button class="btn btn-sm btn-link" data-open-latest>See all</button>
                    </div>
                    <div class="fc-feed">${items.map(cardHtml).join('')}</div>
                </section>`;
            const more = el.querySelector('[data-open-latest]');
            if (more) more.addEventListener('click', () => window.loadKalkiModule('latest'));
        } catch (err) {
            // Optional extra: stay silent
        }
    };
})();
