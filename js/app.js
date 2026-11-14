// ==========================================================================
// KALKI-KIT APP SHELL
// Navigation, theme, mobile menu, toasts and logout.
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const mainContent = document.getElementById('main-content');
    const topbarTitle = document.getElementById('topbar-title');

    // ----------------------------------------------------------------------
    // Theme
    // ----------------------------------------------------------------------
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    function paintThemeButton(theme) {
        const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        themeBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        themeBtn.setAttribute('aria-label', label);
        themeBtn.setAttribute('title', label);
        if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#090d18' : '#f3f5fb');
    }

    if (themeBtn) {
        let saved = 'dark';
        try { saved = localStorage.getItem('kalki_theme') || 'dark'; } catch (e) { /* storage blocked */ }
        document.documentElement.setAttribute('data-bs-theme', saved);
        paintThemeButton(saved);

        themeBtn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            const root = document.documentElement;
            root.classList.add('theme-switching');
            setTimeout(() => root.classList.remove('theme-switching'), 400);
            root.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('kalki_theme', next); } catch (e) { /* storage blocked */ }
            paintThemeButton(next);
        });
    }

    // ----------------------------------------------------------------------
    // Mobile drawer
    // ----------------------------------------------------------------------
    function openDrawer() {
        sidebar.classList.add('mobile-open');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
    document.getElementById('mobile-menu-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        sidebar.classList.contains('mobile-open') ? closeDrawer() : openDrawer();
    });
    document.getElementById('sidebar-close-btn')?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    // ----------------------------------------------------------------------
    // Pages
    // ----------------------------------------------------------------------
    const PAGES = {
        verify: { title: 'Fact Check', hash: '', render: c => window.renderVerification(c) },
        image: { title: 'Image Check', hash: '#image', render: c => window.renderImageCheck(c) },
        latest: { title: 'Latest Fact-Checks', hash: '#latest', render: c => window.renderLatest(c) },
        history: { title: 'My Checks', hash: '#history', render: c => window.renderClaims(c) }
    };
    const pageFromHash = () => { const name = location.hash.slice(1); return PAGES[name] ? name : 'verify'; };
    const navItems = document.querySelectorAll('.sidebar .nav-item[data-target]');
    const bottomItems = document.querySelectorAll('.bottom-nav-item[data-target]');
    let currentPage = null;

    function loadModule(target, { updateHash = true } = {}) {
        const page = PAGES[target] || PAGES.verify;
        const name = PAGES[target] ? target : 'verify';
        closeDrawer();

        [...navItems, ...bottomItems].forEach(el => {
            const on = el.getAttribute('data-target') === name;
            el.classList.toggle('active', on);
            if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
        });
        if (topbarTitle) topbarTitle.textContent = page.title;
        document.title = `${page.title} | Kalki-Kit`;
        if (updateHash && currentPage !== null && location.hash !== page.hash) history.pushState(null, '', page.hash || location.pathname);

        mainContent.innerHTML = '';
        page.render(mainContent);
        if (currentPage !== name) mainContent.scrollTop = 0;
        currentPage = name;
    }
    window.loadKalkiModule = loadModule;

    [...navItems, ...bottomItems].forEach(item => {
        item.addEventListener('click', () => loadModule(item.getAttribute('data-target')));
    });
    // Sidebar entries are <li>s: make them keyboard-operable like buttons
    navItems.forEach(item => {
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
        });
    });

    // Browser back / forward
    window.addEventListener('popstate', () => loadModule(pageFromHash(), { updateHash: false }));

    // ----------------------------------------------------------------------
    // Toasts (text only: never inserted as HTML)
    // ----------------------------------------------------------------------
    window.showKalkiToast = function (title, message, type = 'info') {
        const container = document.getElementById('kalki-toast-container');
        if (!container) return;

        const colors = { danger: ['#f43f5e', 'fa-circle-exclamation'], warning: ['#f59e0b', 'fa-triangle-exclamation'], success: ['#10b981', 'fa-circle-check'], info: ['#6366f1', 'fa-circle-info'] };
        const [color, icon] = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.className = 'toast kalki-toast align-items-center mb-2';
        toast.setAttribute('role', 'status');
        toast.style.setProperty('--toast-accent', color);

        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-start p-3 gap-2';
        const iconEl = document.createElement('i');
        iconEl.className = `fa-solid ${icon} mt-1`;
        iconEl.style.color = color;
        const body = document.createElement('div');
        body.className = 'flex-grow-1 min-w-0';
        const titleEl = document.createElement('div');
        titleEl.className = 'fw-bold small toast-title';
        titleEl.textContent = title;
        const msgEl = document.createElement('div');
        msgEl.className = 'small toast-message';
        msgEl.textContent = message.length > 90 ? message.slice(0, 88) + '…' : message;
        body.append(titleEl, msgEl);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-close btn-close-white';
        close.setAttribute('data-bs-dismiss', 'toast');
        close.setAttribute('aria-label', 'Close');
        row.append(iconEl, body, close);
        toast.append(row);
        container.appendChild(toast);

        if (window.bootstrap?.Toast) {
            const t = new bootstrap.Toast(toast, { delay: 4500 });
            toast.addEventListener('hidden.bs.toast', () => toast.remove());
            t.show();
        } else {
            setTimeout(() => toast.remove(), 4500);
        }
    };

    // ----------------------------------------------------------------------
    // Logout
    // ----------------------------------------------------------------------
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (confirm('Log out of Kalki-Kit?')) window.logoutUser();
    });

    // First page: honour a #image, #latest or #history link
    loadModule(pageFromHash(), { updateHash: false });
});
