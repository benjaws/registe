// Dock Mirabox 293S (15 touches écran + 3 boutons) piloté depuis le navigateur (WebHID, Chrome/Edge).
// Chaque touche déclenche une action de la régie (impro, musique, lumières, séquences) et affiche
// son état en direct (chrono, noir actif, séquence en cours, GO en attente…).
// La disposition touche → action se règle dans la fenêtre « 🎛️ Dock » et est enregistrée par compte.
//
// Protocole (rétro-ingénierie, cf. projets mirajazz / opendeck-akp153) :
//   sortie : rapports de 512 o (1024 sur les 293SV3) commençant par "CRT\0\0" + commande ;
//   image  : "BAT" + longueur JPEG sur 2 o + n° de touche, puis le JPEG en paquets, puis "STP" ;
//   entrée : "ACK…", octet 9 = n° de touche (1-18), octet 10 = état (1 appui / 0 relâché selon firmware).

(function () {
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------------------------------------------------------------------
    //  Matériel
    // ---------------------------------------------------------------------
    const DEVICES = [
        { vendorId: 0x5548, productId: 0x6670, name: 'Mirabox 293S', pv: 1 },
        { vendorId: 0x5548, productId: 0x6674, name: 'Ajazz AKP153', pv: 1 },
        { vendorId: 0x0300, productId: 0x1010, name: 'Ajazz AKP153E', pv: 1 },
        { vendorId: 0x0300, productId: 0x1020, name: 'Ajazz AKP153R', pv: 1 },
        { vendorId: 0x6603, productId: 0x1014, name: 'Mirabox 293SV3', pv: 3 },
        { vendorId: 0x6603, productId: 0x1005, name: 'Mirabox 293SV3', pv: 3 },
        { vendorId: 0x0300, productId: 0x3010, name: 'Ajazz AKP153E', pv: 3 },
        { vendorId: 0x0300, productId: 0x3011, name: 'Ajazz AKP153R', pv: 3 },
    ];
    const ROWS = 3, COLS = 6;          // colonne 6 = les 3 boutons sans écran
    const SCREEN_COLS = 5;
    const IMG = 85;                    // px, touches du 293S
    const KEEPALIVE_MS = 10000;

    // Position visuelle (ligne, colonne) ↔ n° de touche du dock (1-18)
    //   ligne 0 : 13 10  7  4  1 | 16
    //   ligne 1 : 14 11  8  5  2 | 17
    //   ligne 2 : 15 12  9  6  3 | 18
    const keyId = (r, c) => c < SCREEN_COLS ? (SCREEN_COLS - 1 - c) * 3 + r + 1 : 16 + r;
    function posOf(id) {
        if (id >= 16 && id <= 18) return [id - 16, SCREEN_COLS];
        if (id < 1 || id > 15) return null;
        return [(id - 1) % 3, SCREEN_COLS - 1 - Math.floor((id - 1) / 3)];
    }

    let dev = null, info = null, packet = 512, queue = Promise.resolve();
    let keepAlive = null, syncTimer = null, syncing = false;
    let sentSig = {};                  // 'r,c' → signature de l'image affichée
    let sawStateFlag = false;          // le firmware envoie-t-il des « relâché » (état 0) ?
    const lastPress = {};

    const CRT = [0x43, 0x52, 0x54, 0, 0];
    const ascii = s => Array.from(s, ch => ch.charCodeAt(0));

    function report(bytes) {
        const buf = new Uint8Array(packet);
        buf.set(bytes.slice(0, packet));
        return buf;
    }
    function send(buf) {
        const d = dev;
        queue = queue.then(() => d && d.opened ? d.sendReport(0, buf) : null)
                     .catch(e => console.warn('[Dock] envoi', e));
        return queue;
    }
    const cmd = (...parts) => send(report([...CRT, ...parts.flat()]));
    const setBrightness = pct => cmd(ascii('LIG'), [0, 0, Math.max(0, Math.min(100, pct | 0))]);
    const clearAll = () => cmd(ascii('CLE'), [0, 0, 0, 0xff]);
    const flush = () => cmd(ascii('STP'));

    function sendImage(id, jpeg) {
        const len = jpeg.length;
        send(report([...CRT, ...ascii('BAT'), 0, 0, (len >> 8) & 0xff, len & 0xff, id]));
        for (let o = 0; o < len; o += packet) send(report(Array.from(jpeg.subarray(o, o + packet))));
    }

    function packetSizeOf(d) {
        for (const c of d.collections || []) {
            for (const r of c.outputReports || []) {
                const bits = (r.items || []).reduce((n, it) => n + (it.reportSize || 0) * (it.reportCount || 0), 0);
                if (bits >= 8 * 64) return bits / 8;
            }
        }
        return info && info.pv >= 2 ? 1024 : 512;
    }

    async function open(d) {
        if (dev && dev !== d) await close();
        if (!d.opened) await d.open();
        dev = d;
        info = DEVICES.find(x => x.vendorId === d.vendorId && x.productId === d.productId) || { name: d.productName || 'Dock', pv: 1 };
        packet = packetSizeOf(d);
        d.addEventListener('inputreport', onInput);
        cmd(ascii('DIS'));
        setBrightness(layout.brightness);
        clearAll();
        flush();
        sentSig = {};
        clearInterval(keepAlive);
        keepAlive = setInterval(() => cmd(ascii('CONNECT')), KEEPALIVE_MS);
        clearInterval(syncTimer);
        syncTimer = setInterval(sync, 300);
        sync();
        status();
    }

    async function close() {
        clearInterval(keepAlive); clearInterval(syncTimer);
        keepAlive = syncTimer = null;
        const d = dev;
        dev = null;
        if (d) {
            d.removeEventListener('inputreport', onInput);
            try {
                if (d.opened) {
                    await d.sendReport(0, report([...CRT, ...ascii('CLE'), 0, 0, 0, 0xff]));
                    await d.sendReport(0, report([...CRT, ...ascii('STP')]));
                    await d.close();
                }
            } catch (e) { /* débranché */ }
        }
        status();
    }

    async function connect() {
        if (!('hid' in navigator)) {
            alert('Dock : utilise Chrome ou Edge (WebHID) sur le PC où le dock est branché.');
            return;
        }
        try {
            const list = await navigator.hid.requestDevice({
                filters: DEVICES.map(({ vendorId, productId }) => ({ vendorId, productId })),
            });
            // Un dock expose parfois plusieurs interfaces : on prend celle qui a des rapports de sortie
            const d = list.find(x => (x.collections || []).some(c => (c.outputReports || []).length)) || list[0];
            if (d) await open(d);
        } catch (e) { console.error('[Dock]', e); status('Échec : ' + e.message); }
    }

    async function autoReconnect() {
        if (!('hid' in navigator)) return;
        try {
            const list = await navigator.hid.getDevices();
            const d = list.find(x => DEVICES.some(k => k.vendorId === x.vendorId && k.productId === x.productId)
                && (x.collections || []).some(c => (c.outputReports || []).length));
            if (d) await open(d);
        } catch (e) { /* on attendra le clic */ }
    }

    function onInput(e) {
        const v = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
        if (v[0] !== 0x41 || v[1] !== 0x43 || v[2] !== 0x4b) return;      // "ACK"
        const id = v[9], state = v[10];
        if (!id) return;
        // Firmware à appui + relâché : on n'agit qu'à l'appui. Sinon chaque rapport est un appui.
        if (state === 1) sawStateFlag = true;
        if (state === 0 && sawStateFlag) return;
        const now = Date.now();
        if (now - (lastPress[id] || 0) < 120) return;
        lastPress[id] = now;
        const pos = posOf(id);
        if (pos) pressAt(pos[0], pos[1]);
    }

    function status(err) {
        const b = $('dockStatus');
        if (b) {
            b.textContent = err || (dev ? info.name + ' connecté' : 'Non connecté');
            b.className = 'badge ' + (dev ? 'bg-success' : 'bg-secondary');
        }
        const c = $('dockConnect'), x = $('dockDisconnect'), h = $('dockBtn');
        if (c) c.style.display = dev ? 'none' : '';
        if (x) x.style.display = dev ? '' : 'none';
        if (h) h.classList.toggle('dock-on', !!dev);
    }

    // ---------------------------------------------------------------------
    //  Actions
    // ---------------------------------------------------------------------
    const K = () => window.RegisteKeys || {};
    const toast = t => K().toast && K().toast(t);
    const press = id => K().press && K().press(id);
    const D = () => window.DMX;
    const S = () => window.Sequences;
    const A = () => window.Ambiance;
    const visible = id => { const b = $(id); return !!(b && !b.disabled && b.offsetParent !== null); };
    const lightsOk = () => !!(D() && D().isConnected());

    const COLOR = {
        froid: { label: 'Blanc froid', css: '#cfe2ff', fg: '#000' },
        chaud: { label: 'Blanc chaud', css: '#ffc489', fg: '#000' },
        rouge: { label: 'Rouge', css: '#ff3b3b', fg: '#fff' },
        vert:  { label: 'Vert', css: '#35c759', fg: '#000' },
        bleu:  { label: 'Bleu', css: '#2d6cdf', fg: '#fff' },
    };

    function audioPlaying() {
        return ['musicPlayer', 'audioTransition'].some(id => { const a = $(id); return a && a.src && !a.paused; });
    }
    function masterPct() {
        const m = $('dmxMaster');
        return m ? Math.round(+m.value / 255 * 100) : 100;
    }
    function seqRunning(seq) { const st = S() && S().state(); return !!(st && seq && st.seq.id === seq.id); }
    let musics = [];

    function playMp3(file, title) {
        const a = $('musicPlayer');
        if (!a) return;
        const sel = $('musicSelect');
        if (sel && Array.from(sel.options).some(o => o.value === file)) sel.value = file;
        if (window.RegisteSpotify && window.RegisteSpotify.isActive()) window.RegisteSpotify.setTab('local');
        a.src = 'music/' + file;
        a.play().catch(() => {});
        toast('🎵 ' + title);
    }

    // Actions fixes : id → { group, icon, label, run, face?(base) }
    const STATIC = {
        'impro:validate': { group: 'Impro', icon: '✅', label: 'Valider', bg: '#2b333b',
            run: () => { const f = $('selectCatForm'); if (f) { f.requestSubmit(); toast('✓ Catégorie validée'); } } },
        'impro:play': { group: 'Impro', icon: '▶️', label: 'Jouer', bg: '#15803d',
            run: () => press('playBtn') && toast('▶ Jouer'),
            face: f => {
                const t = ($('chrono') || {}).textContent || '';
                if (t.trim()) return { ...f, icon: '', big: t.trim(), active: true };
                return { ...f, dim: !visible('playBtn') };
            } },
        'impro:stop': { group: 'Impro', icon: '⏹️', label: 'Stopper', bg: '#cc2e4c',
            run: () => press('stopBtn') && toast('⏹ Stopper'),
            face: f => ({ ...f, dim: !visible('stopBtn') }) },

        'music:toggle': { group: 'Musique', icon: '⏯️', label: 'Lecture', bg: '#38424d',
            run: () => K().music && K().music.toggle(),
            face: f => audioPlaying() ? { ...f, icon: '⏸️', label: 'Pause', active: true } : f },
        'music:prev': { group: 'Musique', icon: '⏮️', label: 'Précédent', bg: '#38424d', run: () => K().music && K().music.prev() },
        'music:next': { group: 'Musique', icon: '⏭️', label: 'Suivant', bg: '#38424d', run: () => K().music && K().music.next() },
        'music:volup': { group: 'Musique', icon: '🔊', label: 'Volume +', bg: '#38424d', run: () => K().music && K().music.volume(+0.1) },
        'music:voldown': { group: 'Musique', icon: '🔉', label: 'Volume −', bg: '#38424d', run: () => K().music && K().music.volume(-0.1) },
        'music:fade': { group: 'Musique', icon: '🔇', label: 'Fondu son', bg: '#38424d',
            run: () => {
                if (typeof window.stopAllSound === 'function') window.stopAllSound();
                else press('stopMusicBtn');
                if (window.RegisteSpotify) window.RegisteSpotify.pause();
                toast('🔇 Fondu musique');
            } },
        'music:tab': { group: 'Musique', icon: '🔀', label: 'Local/Spotify', bg: '#38424d',
            run: () => { const a = K().KEYS && K().KEYS['t']; if (a) a(); } },

        'light:warm': { group: 'Lumières', icon: '💡', label: 'Base', bg: '#ffc489', fg: '#000',
            run: () => press('dmxWarm') && toast('💡 Base (blanc chaud)'), face: f => ({ ...f, dim: !lightsOk() }) },
        'light:blackout': { group: 'Lumières', icon: '🌑', label: 'Noir', bg: '#111',
            run: () => press('dmxBlackout') && toast('🌑 Noir complet / rallumer'),
            face: f => {
                const on = $('dmxBlackout') && $('dmxBlackout').classList.contains('active');
                return on ? { ...f, icon: '💡', label: 'Rallumer', active: true, dim: !lightsOk() } : { ...f, dim: !lightsOk() };
            } },
        'light:up': { group: 'Lumières', icon: '🔆', label: 'Intensité +', bg: '#6b5a12',
            run: () => { if (lightsOk()) { const p = Math.min(100, masterPct() + 10); D().fadeMaster(p, 0); toast('🔆 ' + p + ' %'); } },
            face: f => ({ ...f, label: masterPct() + ' % +', dim: !lightsOk() }) },
        'light:down': { group: 'Lumières', icon: '🔅', label: 'Intensité −', bg: '#6b5a12',
            run: () => { if (lightsOk()) { const p = Math.max(0, masterPct() - 10); D().fadeMaster(p, 0); toast('🔅 ' + p + ' %'); } },
            face: f => ({ ...f, label: masterPct() + ' % −', dim: !lightsOk() }) },

        'seq:go': { group: 'Séquences', icon: '✋', label: 'GO', bg: '#d9ad12', fg: '#38424d',
            run: () => S() && S().go(),
            face: f => {
                const st = S() && S().state();
                if (st && st.waitingGo) return { ...f, active: true, blink: true };
                return { ...f, dim: true };
            } },
        'seq:stop': { group: 'Séquences', icon: '⏹️', label: 'Arrêter séq.', bg: '#38424d',
            run: () => { if (S() && S().state()) { S().stop(); toast('⏹ Séquence arrêtée'); } },
            face: f => ({ ...f, dim: !(S() && S().state()) }) },
        'amb:focus': { group: 'Ambiance', icon: '🎭', label: 'Taper un lieu', bg: '#5b3a8c',
            run: () => A() && A().focus() },
        'amb:stop': { group: 'Ambiance', icon: '🔇', label: 'Couper nappe', bg: '#38424d',
            run: () => { if (A()) { A().stopSound(2); toast('🔇 Nappe coupée'); } },
            face: f => ({ ...f, dim: !(A() && A().isPlaying()) }) },
    };

    // Résout un id d'action (fixe ou dynamique) en { label, icon, bg, fg, run, face }
    function resolve(id) {
        if (!id) return null;
        if (STATIC[id]) return STATIC[id];
        let m;
        if ((m = /^seqi:(\d+)$/.exec(id))) {
            const i = +m[1];
            const seq = () => (S() ? S().list() : [])[i];
            return { icon: '🎬', label: 'Séquence ' + (i + 1), bg: '#4b3a8c',
                run: () => { const s = seq(); if (s) { S().runIndex(i); toast('🎬 ' + s.name); } },
                face: f => { const s = seq(); return s ? { ...f, label: s.name, active: seqRunning(s) } : { ...f, dim: true }; } };
        }
        if ((m = /^amb:(.+)$/.exec(id))) {
            const amb = () => (A() ? A().list() : []).find(p => p.id === m[1]);
            return { icon: '🎭', label: 'Ambiance', bg: '#5b3a8c',
                run: () => { if (amb()) A().apply({ id: m[1] }); },
                face: f => { const p = amb(), cur = A() && A().current();
                    return p ? { ...f, icon: p.emoji || '🎭', label: p.name, bg: (p.colors || [])[0] || f.bg, fg: '#000',
                                 active: !!(cur && cur.id === p.id) } : { ...f, label: '(oubliée)', dim: true }; } };
        }
        if ((m = /^seq:(.+)$/.exec(id))) {
            const seq = () => (S() ? S().list() : []).find(s => s.id === m[1]);
            return { icon: '🎬', label: 'Séquence', bg: '#4b3a8c',
                run: () => { const s = seq(); if (s) { S().run(s); toast('🎬 ' + s.name); } },
                face: f => { const s = seq(); return s ? { ...f, label: s.name, active: seqRunning(s) } : { ...f, label: '(supprimée)', dim: true }; } };
        }
        if ((m = /^light:color:(.+):([a-z]+)$/.exec(id)) && COLOR[m[2]]) {
            const target = m[1], c = COLOR[m[2]];
            const fxName = () => {
                if (target === 'all') return 'Tous';
                const fx = (D() ? D().getFixtures() : []).find(f => f.id === target);
                return fx ? fx.name : '?';
            };
            return { icon: '', label: c.label, bg: c.css, fg: c.fg,
                run: () => {
                    if (!lightsOk()) return;
                    const idx = target === 'all' ? 'all' : D().getFixtures().findIndex(f => f.id === target);
                    if (idx === -1) return;
                    D().applyColor(idx, m[2]);
                    toast('💡 ' + fxName() + ' → ' + c.label);
                },
                face: f => ({ ...f, big: fxName(), dim: !lightsOk() }) };
        }
        if ((m = /^mp3:(.+)$/.exec(id))) {
            const file = m[1];
            const title = () => (musics.find(x => x.filename === file) || {}).title || file;
            return { icon: '🎵', label: 'mp3', bg: '#1f5f8b',
                run: () => playMp3(file, title()),
                face: f => {
                    const a = $('musicPlayer');
                    const on = a && !a.paused && decodeURIComponent(a.src || '').endsWith('/' + file);
                    return { ...f, label: title(), active: on };
                } };
        }
        return null;
    }

    function faceOf(id) {
        const a = resolve(id);
        if (!a) return null;
        const base = { icon: a.icon, label: a.label, bg: a.bg || '#38424d', fg: a.fg || '#fff' };
        return a.face ? a.face(base) : base;
    }

    // Liste pour le sélecteur de la fenêtre de configuration
    function catalog() {
        const out = [];
        Object.entries(STATIC).forEach(([id, a]) => out.push({ id, group: a.group, label: a.icon + ' ' + a.label }));
        const seqs = S() ? S().list() : [];
        seqs.forEach(s => out.push({ id: 'seq:' + s.id, group: 'Séquences', label: '🎬 ' + s.name }));
        for (let i = 0; i < 9; i++) out.push({ id: 'seqi:' + i, group: 'Séquences (par position)', label: '🎬 Séquence n°' + (i + 1) });
        const fixtures = [{ id: 'all', name: 'Tous' }].concat(D() ? D().getFixtures() : []);
        fixtures.forEach(fx => Object.entries(COLOR).forEach(([k, c]) =>
            out.push({ id: 'light:color:' + fx.id + ':' + k, group: 'Couleurs — ' + fx.name, label: c.label })));
        (A() ? A().list() : []).forEach(p => out.push({ id: 'amb:' + p.id, group: 'Ambiances', label: (p.emoji || '🎭') + ' ' + p.name }));
        musics.forEach(m => out.push({ id: 'mp3:' + m.filename, group: 'Jouer un mp3', label: '🎵 ' + (m.title || m.filename) }));
        return out;
    }

    // ---------------------------------------------------------------------
    //  Disposition
    // ---------------------------------------------------------------------
    const DEFAULT_LAYOUT = {
        version: 1, brightness: 70, rotation: 270,
        keys: {
            '0,0': 'impro:validate', '0,1': 'impro:play', '0,2': 'impro:stop', '0,3': 'seq:go', '0,4': 'seq:stop',
            '1,0': 'seqi:0', '1,1': 'seqi:1', '1,2': 'seqi:2', '1,3': 'seqi:3', '1,4': 'seqi:4',
            '2,0': 'music:toggle', '2,1': 'music:prev', '2,2': 'music:next', '2,3': 'music:voldown', '2,4': 'music:volup',
            '0,5': 'light:blackout', '1,5': 'light:warm', '2,5': 'music:fade',
        },
    };
    let layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));

    async function loadLayout() {
        try {
            const r = await fetch('dock_layout.php', { cache: 'no-store' });
            const l = r.ok ? await r.json() : null;
            if (l && l.keys) layout = { ...DEFAULT_LAYOUT, ...l, keys: Array.isArray(l.keys) ? {} : l.keys };
        } catch (e) { /* disposition par défaut */ }
    }
    async function saveLayout() {
        const r = await fetch('dock_layout.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layout),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
    }

    function pressAt(r, c) {
        flashCell(r, c);
        const a = resolve(layout.keys[r + ',' + c]);
        if (!a) return;
        try { a.run(); } catch (e) { console.error('[Dock] action', e); }
        setTimeout(sync, 60);
    }

    // ---------------------------------------------------------------------
    //  Rendu des touches
    // ---------------------------------------------------------------------
    const face = document.createElement('canvas');
    face.width = face.height = IMG;
    const out = document.createElement('canvas');
    out.width = out.height = IMG;
    let blinkOn = false;

    function wrap(ctx, text, maxW, maxLines) {
        const words = String(text).split(/\s+/);
        const lines = [];
        let cur = '';
        for (const w of words) {
            const t = cur ? cur + ' ' + w : w;
            if (ctx.measureText(t).width <= maxW || !cur) cur = t;
            else { lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        if (lines.length > maxLines) {
            lines.length = maxLines;
            let l = lines[maxLines - 1];
            while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
            lines[maxLines - 1] = l + '…';
        }
        return lines;
    }

    function drawFace(f) {
        const ctx = face.getContext('2d');
        const W = IMG;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, W);
        if (!f) return face;
        const lit = !(f.blink && !blinkOn);
        ctx.fillStyle = lit ? f.bg : '#000';
        ctx.fillRect(0, 0, W, W);
        ctx.fillStyle = f.fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const font = (w, px) => `${w} ${px}px Inter, "Segoe UI", system-ui, sans-serif`;
        if (f.big) {
            ctx.font = font(800, 24);
            let px = 24;
            while (px > 12 && ctx.measureText(f.big).width > W - 8) { px -= 2; ctx.font = font(800, px); }
            ctx.fillText(f.big, W / 2, f.icon ? 48 : 36);
            ctx.font = font(600, 13);
            ctx.fillText(wrap(ctx, f.label, W - 8, 1)[0] || '', W / 2, 68);
        } else {
            if (f.icon) {
                ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
                ctx.fillText(f.icon, W / 2, 30);
            }
            ctx.font = font(700, 13);
            const lines = wrap(ctx, f.label, W - 8, f.icon ? 2 : 4);
            const y0 = f.icon ? 60 : W / 2 - (lines.length - 1) * 8;
            lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * 15));
        }
        if (f.active) {
            ctx.strokeStyle = '#eec41e';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, W - 6, W - 6);
        }
        if (f.dim) {
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillRect(0, 0, W, W);
        }
        return face;
    }

    function toJpeg(f) {
        drawFace(f);
        const ctx = out.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, IMG, IMG);
        // Le dock affiche l'image tournée : on la pré-tourne (sens horaire) pour qu'elle apparaisse droite
        ctx.translate(IMG / 2, IMG / 2);
        ctx.rotate((layout.rotation || 0) * Math.PI / 180);
        ctx.translate(-IMG / 2, -IMG / 2);
        ctx.drawImage(face, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return new Promise(res => out.toBlob(b => b.arrayBuffer().then(ab => res(new Uint8Array(ab))), 'image/jpeg', 0.9));
    }

    async function sync() {
        blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
        if (modalOpen) renderGrid();
        if (!dev || syncing) return;
        syncing = true;
        try {
            let changed = false;
            for (let r = 0; r < ROWS; r++) for (let c = 0; c < SCREEN_COLS; c++) {
                const pos = r + ',' + c;
                const f = faceOf(layout.keys[pos]);
                const sig = JSON.stringify([f, f && f.blink ? blinkOn : 0, layout.rotation]);
                if (sentSig[pos] === sig) continue;
                const jpeg = await toJpeg(f);
                if (!dev) return;
                sendImage(keyId(r, c), jpeg);
                sentSig[pos] = sig;
                changed = true;
            }
            if (changed) await flush();
        } catch (e) {
            console.warn('[Dock] rendu', e);
        } finally { syncing = false; }
    }

    // ---------------------------------------------------------------------
    //  Fenêtre de configuration
    // ---------------------------------------------------------------------
    let modalOpen = false, selected = null, gridSig = '';

    function renderGrid() {
        const g = $('dockGrid');
        if (!g) return;
        const faces = [];
        let sig = String(selected);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const f = faceOf(layout.keys[r + ',' + c]);
            faces.push(f);
            sig += '|' + JSON.stringify([f, f && f.blink ? blinkOn : 0]);
        }
        if (sig === gridSig) return;
        gridSig = sig;
        const cells = [];
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const pos = r + ',' + c, id = layout.keys[pos];
            const f = faces[r * COLS + c];
            const sel = selected === pos ? ' selected' : '';
            if (c < SCREEN_COLS) {
                const url = drawFace(f).toDataURL('image/png');
                cells.push(`<button type="button" class="dock-key${sel}" data-pos="${pos}" title="${esc(f ? f.label : 'Vide')}"><img src="${url}" alt=""></button>`);
            } else {
                const a = resolve(id);
                cells.push(`<button type="button" class="dock-side${sel}" data-pos="${pos}" title="${esc(a ? a.label : 'Vide')}">
                    <span class="dock-side-dot"></span><span class="dock-side-lbl">${esc(a ? (a.icon ? a.icon + ' ' : '') + a.label : '—')}</span></button>`);
            }
        }
        g.innerHTML = cells.join('');
    }

    function renderPicker() {
        const p = $('dockPicker');
        if (!p) return;
        if (!selected) { p.innerHTML = '<div class="text-muted small">Clique une touche pour lui choisir une action.</div>'; return; }
        const [r, c] = selected.split(',').map(Number);
        const cur = layout.keys[selected] || '';
        const groups = {};
        catalog().forEach(o => (groups[o.group] = groups[o.group] || []).push(o));
        if (cur && !catalog().some(o => o.id === cur)) (groups['Autre'] = []).push({ id: cur, label: cur });
        const opts = Object.entries(groups).map(([g, list]) =>
            `<optgroup label="${esc(g)}">${list.map(o => `<option value="${esc(o.id)}"${o.id === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</optgroup>`).join('');
        const where = c < SCREEN_COLS ? `ligne ${r + 1}, colonne ${c + 1}` : `bouton latéral ${r + 1}`;
        p.innerHTML = `<label class="form-label small mb-1">Touche ${where}</label>
            <div class="d-flex gap-2">
              <select class="form-select form-select-sm" id="dockAction"><option value="">— Aucune —</option>${opts}</select>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="dockTry" title="Déclencher l'action">▶ Tester</button>
            </div>`;
        $('dockAction').addEventListener('change', e => {
            if (e.target.value) layout.keys[selected] = e.target.value; else delete layout.keys[selected];
            dirty(true);
            sync();
        });
        $('dockTry').addEventListener('click', () => pressAt(r, c));
    }

    function flashCell(r, c) {
        if (!modalOpen) return;
        const el = document.querySelector(`#dockGrid [data-pos="${r},${c}"]`);
        if (el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 250); }
        const l = $('dockLast');
        if (l) l.textContent = c < SCREEN_COLS ? `Dernier appui : ligne ${r + 1}, colonne ${c + 1}` : `Dernier appui : bouton latéral ${r + 1}`;
    }

    function dirty(on) {
        const b = $('dockSave');
        if (b) { b.disabled = !on; b.textContent = on ? 'Enregistrer' : 'Enregistré'; }
    }

    function initModal() {
        const m = $('dockModal');
        if (!m) return;
        m.addEventListener('shown.bs.modal', () => {
            modalOpen = true; gridSig = '';
            $('dockBrightness').value = layout.brightness;
            $('dockRotation').value = String(layout.rotation);
            renderGrid(); renderPicker();
            fetch('data/musics.json.php?' + Date.now()).then(r => r.ok ? r.json() : []).then(l => {
                musics = (l || []).filter(x => x.active !== false); renderPicker();
            }).catch(() => {});
        });
        m.addEventListener('hidden.bs.modal', () => { modalOpen = false; });
        $('dockGrid').addEventListener('click', e => {
            const b = e.target.closest('[data-pos]');
            if (!b) return;
            selected = b.dataset.pos;
            gridSig = '';
            renderGrid(); renderPicker();
        });
        $('dockConnect').addEventListener('click', connect);
        $('dockDisconnect').addEventListener('click', close);
        $('dockBrightness').addEventListener('input', e => {
            layout.brightness = +e.target.value;
            if (dev) setBrightness(layout.brightness);
            dirty(true);
        });
        $('dockRotation').addEventListener('change', e => { layout.rotation = +e.target.value; sentSig = {}; dirty(true); sync(); });
        $('dockReset').addEventListener('click', () => {
            if (!confirm('Revenir à la disposition par défaut ?')) return;
            layout.keys = JSON.parse(JSON.stringify(DEFAULT_LAYOUT.keys));
            gridSig = ''; renderGrid(); renderPicker(); dirty(true); sync();
        });
        $('dockSave').addEventListener('click', async () => {
            try { await saveLayout(); dirty(false); toast('🎛️ Dock enregistré'); }
            catch (e) { alert('Enregistrement impossible : ' + e.message); }
        });
        const open = () => bootstrap.Modal.getOrCreateInstance(m).show();
        const btn = $('dockBtn');
        if (btn) btn.addEventListener('click', open);
        if (!('hid' in navigator)) {
            $('dockConnect').disabled = true;
            status('WebHID indisponible (Chrome/Edge)');
        }
        dirty(false);
    }

    window.RegisteDock = { connect, close, isConnected: () => !!dev, layout: () => layout, pressAt };

    document.addEventListener('DOMContentLoaded', async () => {
        initModal();
        await loadLayout();
        status();
        if ('hid' in navigator) {
            navigator.hid.addEventListener('disconnect', e => { if (e.device === dev) { dev = null; close(); } });
            navigator.hid.addEventListener('connect', () => { if (!dev) autoReconnect(); });
            autoReconnect();
        }
        fetch('data/musics.json.php?' + Date.now()).then(r => r.ok ? r.json() : []).then(l => {
            musics = (l || []).filter(x => x.active !== false);
        }).catch(() => {});
        // l'aperçu de la fenêtre suit l'état même sans dock branché
        setInterval(() => { if (!dev && modalOpen) sync(); }, 300);
    });
})();
