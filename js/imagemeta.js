// ==========================================================================
// KALKI-KIT IMAGE FILE HELPERS
// Runs in the browser, before anything is uploaded:
//   - readImageMetadata(): camera, editing software, date taken, GPS present,
//     Content Credentials (C2PA) present, and any AI tool named in the file
//   - prepareImage(): a smaller JPEG copy to upload and a tiny thumbnail
// Missing metadata is normal (WhatsApp, X and Facebook strip it), so it is
// only ever reported as a fact, never as a sign of anything.
// ==========================================================================

(function () {
    const AI_TOOLS = /(midjourney|dall[-·\s]?e|stable[\s-]?diffusion|adobe firefly|firefly|imagen|leonardo\.ai|comfyui|automatic1111|novelai|ideogram|flux\.1|sdxl|openai|chatgpt|gemini|copilot designer|bing image creator|nightcafe|dreamstudio|runway)/i;

    const ascii = (view, start, len) => {
        let s = '';
        for (let i = 0; i < len && start + i < view.byteLength; i++) {
            const c = view.getUint8(start + i);
            if (c === 0) break;
            s += String.fromCharCode(c);
        }
        return s.trim();
    };

    // ---- JPEG: EXIF (TIFF structure) ------------------------------------
    function readExif(view, tiffStart) {
        const out = { gps: false };
        const little = view.getUint16(tiffStart) === 0x4949;
        const u16 = o => view.getUint16(o, little);
        const u32 = o => view.getUint32(o, little);
        if (u16(tiffStart + 2) !== 42) return out;

        const readIfd = ifdOffset => {
            const entries = {};
            const base = tiffStart + ifdOffset;
            if (base + 2 > view.byteLength) return entries;
            const n = Math.min(u16(base), 200);
            for (let i = 0; i < n; i++) {
                const e = base + 2 + i * 12;
                if (e + 12 > view.byteLength) break;
                entries[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
            }
            return entries;
        };
        const text = ent => {
            if (!ent || ent.type !== 2) return '';
            const where = ent.count <= 4 ? ent.at : tiffStart + u32(ent.at);
            return ascii(view, where, Math.min(ent.count, 120));
        };

        const ifd0 = readIfd(u32(tiffStart + 4));
        out.make = text(ifd0[0x010F]);
        out.model = text(ifd0[0x0110]);
        out.software = text(ifd0[0x0131]);
        out.modified = text(ifd0[0x0132]);
        out.description = text(ifd0[0x010E]);
        if (ifd0[0x8825]) out.gps = true;
        if (ifd0[0x8769]) {
            const exif = readIfd(u32(ifd0[0x8769].at));
            out.takenAt = text(exif[0x9003]);
        }
        return out;
    }

    function parseJpeg(view) {
        const info = {};
        let xmp = '';
        let pos = 2;
        while (pos + 4 < view.byteLength) {
            if (view.getUint8(pos) !== 0xFF) break;
            const marker = view.getUint8(pos + 1);
            if (marker === 0xDA || marker === 0xD9) break; // pixels start here
            const len = view.getUint16(pos + 2);
            const body = pos + 4;
            if (marker === 0xE1 && ascii(view, body, 6) === 'Exif') {
                try { Object.assign(info, readExif(view, body + 6)); } catch (e) { /* damaged EXIF: ignore */ }
            } else if (marker === 0xE1 && ascii(view, body, 28).startsWith('http://ns.adobe.com/xap/1.0/')) {
                xmp += new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(view.buffer, view.byteOffset + body + 29, Math.max(0, Math.min(len - 31, 60000, view.byteLength - (body + 29)))));
            } else if (marker === 0xEB) {
                const seg = new TextDecoder('latin1').decode(new Uint8Array(view.buffer, view.byteOffset + body, Math.max(0, Math.min(len - 2, 4000, view.byteLength - body))));
                if (/c2pa|jumb/i.test(seg)) info.credentials = true;
            }
            pos += 2 + len;
        }
        info.xmp = xmp;
        return info;
    }

    // ---- PNG: text chunks (where AI tools write their prompts and settings) ----
    function parsePng(view) {
        const info = { texts: [] };
        let pos = 8;
        const dec = new TextDecoder('utf-8', { fatal: false });
        while (pos + 12 <= view.byteLength) {
            const len = view.getUint32(pos);
            const type = ascii(view, pos + 4, 4);
            if (type === 'caBX') info.credentials = true;
            if ((type === 'tEXt' || type === 'iTXt') && len < 200000) {
                const raw = new Uint8Array(view.buffer, view.byteOffset + pos + 8, len);
                const nul = raw.indexOf(0);
                if (nul > 0) info.texts.push({ key: dec.decode(raw.subarray(0, nul)), value: dec.decode(raw.subarray(nul + 1, nul + 6000)) });
            }
            if (type === 'IDAT' || type === 'IEND') break;
            pos += 12 + len;
        }
        return info;
    }

    function findAiTool(...texts) {
        for (const t of texts) {
            const m = AI_TOOLS.exec(t || '');
            if (m) return m[1];
        }
        return '';
    }

    window.readImageMetadata = async function (file) {
        const meta = { format: (file.type || '').replace('image/', '').toUpperCase() || 'IMAGE', sizeKB: Math.round(file.size / 1024), notes: [] };
        try {
            const buf = await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer();
            const view = new DataView(buf);

            if (view.byteLength > 4 && view.getUint16(0) === 0xFFD8) {
                const j = parseJpeg(view);
                meta.camera = [j.make, j.model].filter(Boolean).join(' ').slice(0, 80);
                meta.software = (j.software || '').slice(0, 80);
                meta.takenAt = (j.takenAt || j.modified || '').replace(/^(\d{4}):(\d\d):(\d\d)/, '$1-$2-$3').slice(0, 40);
                meta.gps = Boolean(j.gps);
                meta.credentials = Boolean(j.credentials);
                const tool = findAiTool(j.software, j.description, j.xmp);
                if (tool) meta.aiTool = tool;
            } else if (view.byteLength > 8 && view.getUint32(0) === 0x89504E47) {
                const p = parsePng(view);
                meta.credentials = Boolean(p.credentials);
                const joined = p.texts.map(t => `${t.key} ${t.value}`).join('\n');
                const tool = findAiTool(p.texts.map(t => t.value).join('\n'));
                if (tool) meta.aiTool = tool;
                else if (p.texts.some(t => t.key === 'parameters' && /Steps:\s*\d+/.test(t.value) && /Sampler:/.test(t.value))) meta.aiTool = 'Stable Diffusion (generation settings in file)';
                else if (p.texts.some(t => t.key === 'prompt' || t.key === 'workflow') && /class_type|"nodes"/.test(joined)) meta.aiTool = 'ComfyUI (workflow in file)';
                const sw = p.texts.find(t => t.key === 'Software');
                if (sw) meta.software = sw.value.slice(0, 80);
            } else if (meta.format === 'WEBP') {
                const head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536)));
                const xmp = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/.exec(head);
                const tool = findAiTool(xmp && xmp[0]);
                if (tool) meta.aiTool = tool;
            }
        } catch (e) {
            // Unreadable metadata is not a finding
        }
        return meta;
    };

    // A smaller JPEG to upload (faster, cheaper) and a small thumbnail to keep in history
    async function render(bitmap, maxSide, quality) {
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // transparent PNGs would otherwise turn black
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        return { blob, dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h };
    }

    window.prepareImage = async function (file) {
        let bitmap;
        try { bitmap = await createImageBitmap(file); } catch (e) { throw new Error('That file could not be opened as an image.'); }
        try {
            let out = await render(bitmap, 1568, 0.85);
            if (out.blob.size > 2.2 * 1024 * 1024) out = await render(bitmap, 1280, 0.7);
            const thumb = await render(bitmap, 160, 0.7);
            const base64 = out.dataUrl.slice(out.dataUrl.indexOf(',') + 1);
            return { base64, blob: out.blob, previewUrl: URL.createObjectURL(out.blob), thumb: thumb.dataUrl, width: bitmap.width, height: bitmap.height };
        } finally {
            if (bitmap.close) bitmap.close();
        }
    };
})();
