// ==========================================================================
// KALKI-KIT SHARE IMAGE
// Draws the result as a 1080px-wide PNG card, sized to its content, ready to
// post. Uses the same shield-and-check mark as the favicon.
// ==========================================================================

window.generateFactPoster = function (data) {
    const canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080, PAD = 80, INNER = W - PAD * 2;
    const FONT = "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";

    const THEME = {
        true:       { c: '#10b981', light: '#6ee7b7' },
        false:      { c: '#f43f5e', light: '#fda4af' },
        partial:    { c: '#f59e0b', light: '#fcd34d' },
        misleading: { c: '#f59e0b', light: '#fcd34d' },
        ambiguous:  { c: '#0ea5e9', light: '#7dd3fc' },
        unverified: { c: '#64748b', light: '#cbd5e1' }
    };
    const t = THEME[data.verdictKey] || THEME.unverified;
    const MEANING = {
        true: 'The evidence we found supports this claim.',
        false: 'The evidence we found contradicts this claim.',
        partial: 'Part of this claim is right and part is wrong.',
        misleading: 'The facts may be real, but important context is missing.',
        ambiguous: 'Too vague, or an opinion, so it cannot be fact-checked.',
        unverified: "Not enough reliable evidence either way. That does not mean it is false."
    };

    const hex = (h, a) => {
        const n = parseInt(h.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };

    // Splits text into lines that fit maxWidth (ellipsis when it runs past maxLines)
    function lines(text, maxWidth, maxLines) {
        const out = [];
        let line = '';
        for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; }
            else line = test;
        }
        if (line) out.push(line);
        if (out.length > maxLines) {
            out.length = maxLines;
            let last = out[maxLines - 1];
            while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
            out[maxLines - 1] = last.trimEnd() + '…';
        }
        return out;
    }

    function para(text, x, y, maxWidth, lineH, maxLines) {
        const ls = lines(text, maxWidth, maxLines);
        ls.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
        return ls.length * lineH;
    }

    function card(x, y, w, h, fill, stroke, radius = 22) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    }

    function label(text, x, y, color = '#94a3b8') {
        ctx.fillStyle = color;
        ctx.font = `700 17px ${FONT}`;
        ctx.letterSpacing = '3px';
        ctx.fillText(text, x, y);
        ctx.letterSpacing = '0px';
    }

    // The brand mark (same shape as assets/favicon.svg)
    function logoMark(x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 64, size / 64);
        const g = ctx.createLinearGradient(0, 0, 64, 64);
        g.addColorStop(0, '#6366f1');
        g.addColorStop(1, '#3b82f6');
        ctx.fillStyle = g;
        ctx.fill(new Path2D('M32 3 56 11v19c0 15-10 25-24 31C18 55 8 45 8 30V11z'));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(new Path2D('M21 32l8 8 15-16'));
        ctx.restore();
    }

    // Verdict icon drawn inside a circle centred on (cx, cy)
    function verdictIcon(cx, cy, r) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = t.c;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = r * 0.17;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const k = r * 0.38;
        ctx.beginPath();
        if (data.verdictKey === 'true') {
            ctx.moveTo(cx - k, cy + k * 0.05); ctx.lineTo(cx - k * 0.25, cy + k * 0.75); ctx.lineTo(cx + k, cy - k * 0.7);
            ctx.stroke();
        } else if (data.verdictKey === 'false') {
            ctx.moveTo(cx - k * 0.85, cy - k * 0.85); ctx.lineTo(cx + k * 0.85, cy + k * 0.85);
            ctx.moveTo(cx + k * 0.85, cy - k * 0.85); ctx.lineTo(cx - k * 0.85, cy + k * 0.85);
            ctx.stroke();
        } else if (data.verdictKey === 'partial' || data.verdictKey === 'misleading') {
            ctx.moveTo(cx, cy - k * 1.05); ctx.lineTo(cx, cy + k * 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy + k * 0.88, r * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.font = `800 ${r * 1.15}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', cx, cy + r * 0.05);
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        }
    }

    function paint(H) {
        canvas.width = W;
        canvas.height = H;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Background: deep navy, a soft glow in the verdict colour, faint dot grid
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0a0f1f');
        bg.addColorStop(1, '#11182e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W - 80, 60, 0, W - 80, 60, 620);
        glow.addColorStop(0, hex(t.c, 0.28));
        glow.addColorStop(1, hex(t.c, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let gx = 40; gx < W; gx += 40) for (let gy = 40; gy < H; gy += 40) ctx.fillRect(gx, gy, 2, 2);

        // Header
        logoMark(PAD, 64, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 34px ${FONT}`;
        ctx.fillText('KALKI-KIT', PAD + 78, 100);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 16px ${FONT}`;
        ctx.letterSpacing = '3px';
        ctx.fillText('NEWS FACT CHECK', PAD + 80, 124);
        ctx.letterSpacing = '0px';
        ctx.textAlign = 'right';
        ctx.font = `500 20px ${FONT}`;
        ctx.fillText(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), W - PAD, 100);
        ctx.textAlign = 'left';

        // Verdict card
        let y = 176;
        const vh = 190;
        card(PAD, y, INNER, vh, hex(t.c, 0.14), hex(t.c, 0.55), 28);
        verdictIcon(PAD + 100, y + vh / 2, 54);
        ctx.fillStyle = t.light;
        ctx.font = `800 ${String(data.verdictLabel).length > 11 ? 52 : 64}px ${FONT}`;
        ctx.fillText(String(data.verdictLabel || '').toUpperCase(), PAD + 190, y + 88);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `500 21px ${FONT}`;
        para(MEANING[data.verdictKey] || MEANING.unverified, PAD + 190, y + 126, data.confidence != null ? 480 : INNER - 220, 28, 2);
        if (data.confidence != null) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 62px ${FONT}`;
            ctx.fillText(`${data.confidence}%`, W - PAD - 36, y + 98);
            ctx.fillStyle = '#94a3b8';
            ctx.font = `600 16px ${FONT}`;
            ctx.letterSpacing = '3px';
            ctx.fillText('CONFIDENCE', W - PAD - 36, y + 130);
            ctx.letterSpacing = '0px';
            ctx.textAlign = 'left';
        }
        y += vh + 56;

        // Claim, with an accent bar
        label('THE CLAIM', PAD, y);
        y += 22;
        ctx.font = `700 38px ${FONT}`;
        const claimLines = lines(`“${data.claim}”`, INNER - 36, 4);
        ctx.fillStyle = t.c;
        ctx.beginPath();
        ctx.roundRect(PAD, y + 8, 6, claimLines.length * 52 - 6, 3);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        claimLines.forEach((l, i) => ctx.fillText(l, PAD + 30, y + 46 + i * 52));
        y += claimLines.length * 52 + 40;

        // Correct information (or, without one, what the evidence shows)
        const hasCorrection = Boolean(data.correction);
        const bodyText = hasCorrection ? data.correction : data.reality;
        if (bodyText) {
            ctx.font = `500 29px ${FONT}`;
            const body = lines(bodyText, INNER - 72, 8);
            const ch = 84 + body.length * 42 + 30;
            card(PAD, y, INNER, ch, hasCorrection ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                hasCorrection ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.12)');
            label(hasCorrection ? 'THE CORRECT INFORMATION' : 'WHAT THE EVIDENCE SHOWS', PAD + 36, y + 52, hasCorrection ? '#6ee7b7' : '#94a3b8');
            ctx.fillStyle = '#f1f5f9';
            ctx.font = `500 29px ${FONT}`;
            body.forEach((l, i) => ctx.fillText(l, PAD + 36, y + 106 + i * 42));
            y += ch + 40;
        }

        // Sources
        const sources = (data.sources || []).slice(0, 3);
        if (sources.length) {
            label('SOURCES', PAD, y + 10);
            y += 34;
            sources.forEach(s => {
                let host = '';
                try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { /* no link */ }
                ctx.fillStyle = s.stance === 'SUPPORTS' ? '#10b981' : s.stance === 'CONTRADICTS' ? '#f43f5e' : '#38bdf8';
                ctx.beginPath();
                ctx.arc(PAD + 10, y + 26, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.font = `700 25px ${FONT}`;
                const name = lines(s.name || s.title, INNER - 40, 1)[0] || '';
                ctx.fillText(name, PAD + 34, y + 34);
                if (host) {
                    ctx.fillStyle = '#64748b';
                    ctx.font = `500 19px ${FONT}`;
                    ctx.fillText(host === 'news.google.com' ? 'via Google News' : host, PAD + 34, y + 62);
                }
                y += 78;
            });
            y += 8;
        }

        // Footer
        y += 14;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(PAD, y, INNER, 2);
        y += 48;
        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 19px ${FONT}`;
        ctx.fillText('Checked against live news, fact-checkers and Wikipedia', PAD, y);
        ctx.fillStyle = '#64748b';
        ctx.font = `500 17px ${FONT}`;
        ctx.fillText('AI-assisted result. Read the sources before you share.', PAD, y + 30);
        return y + 30 + 60;
    }

    function draw() {
        // First pass measures the content, second pass draws it at exactly that height
        const height = Math.max(900, Math.ceil(paint(4000)));
        paint(height);
        const dl = document.getElementById('btn-download-poster');
        if (dl) dl.href = canvas.toDataURL('image/png');
    }

    draw();
    // The page font may still be loading on the first draw: redraw once it is ready so the text is right
    if (document.fonts && document.fonts.load) {
        Promise.all([500, 600, 700, 800].map(w => document.fonts.load(`${w} 20px "Plus Jakarta Sans"`))).then(draw).catch(() => {});
    }
};
