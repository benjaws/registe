// Pilotage DMX des projecteurs via l'Enttec DMX USB PRO (Web Serial).
// Les projecteurs (nom, adresse DMX, type) sont configurés dans l'admin
// et chargés depuis data/fixtures.json.php. Chaque type décrit l'ordre des canaux.

(function () {
    const BAUD = 57600;
    const BLACK_HOLD_MS = 3000;            // 3 s de noir en fin d'impro

    // Couleurs à pleine intensité [R, G, B, W] — ajustables
    const WARM = [60, 20, 0, 255];         // blanc chaud « pas trop chaud »
    const PALETTE = {
        froid: [0, 10, 45, 255],
        chaud: WARM,
        rouge: [255, 0, 0, 0],
        vert:  [0, 255, 0, 0],
        bleu:  [0, 0, 255, 0],
    };

    // Types de projecteurs : offsets de canaux à partir de l'adresse
    const FIXTURE_TYPES = {
        RGB:      { size: 3, r: 0, g: 1, b: 2 },
        RGBW:     { size: 4, r: 0, g: 1, b: 2, w: 3 },
        RGB_DIM:  { size: 4, r: 0, g: 1, b: 2, dim: 3 },
        DIM_RGB:  { size: 4, dim: 0, r: 1, g: 2, b: 3 },
        RGBW_DIM: { size: 5, r: 0, g: 1, b: 2, w: 3, dim: 4 },
        DIM_RGBW: { size: 5, dim: 0, r: 1, g: 2, b: 3, w: 4 },
    };

    // Projecteurs par défaut si le chargement échoue (tes 4 pars RGBW)
    const DEFAULT_FIXTURES = [
        { name: 'Par 1', address: 1, type: 'RGBW' },
        { name: 'Par 2', address: 5, type: 'RGBW' },
        { name: 'Par 3', address: 9, type: 'RGBW' },
        { name: 'Par 4', address: 13, type: 'RGBW' },
    ];

    const universe = new Uint8Array(512);
    let fixtures = [];                      // { name, address, type, color:[r,g,b,w] }
    let port = null, writer = null, running = false, isBlack = false, masterLevel = 255;

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

    // --- Trame Enttec PRO ---
    function dmxFrame(chan) {
        const dataLen = chan.length + 1;
        const out = new Uint8Array(5 + chan.length + 1);
        out[0] = 0x7E; out[1] = 6;
        out[2] = dataLen & 0xFF; out[3] = (dataLen >> 8) & 0xFF;
        out[4] = 0x00;
        out.set(chan, 5);
        out[out.length - 1] = 0xE7;
        return out;
    }

    async function sendLoop() {
        while (running && writer) {
            try { await writer.write(dmxFrame(universe)); }
            catch (e) { console.error('DMX write', e); updateStatus('Erreur', false); break; }
            await sleep(30);
        }
    }

    // --- Écriture d'un projecteur selon son type ---
    function writeFixture(fx) {
        const t = FIXTURE_TYPES[fx.type] || FIXTURE_TYPES.RGBW;
        const a = fx.address - 1; // index 0-based
        for (let k = 0; k < t.size; k++) universe[a + k] = 0; // reset de ses canaux
        if (isBlack) return;      // noir complet : tout à 0
        const hasDim = ('dim' in t);
        const f = hasDim ? 1 : masterLevel / 255;  // si canal dimmer, couleurs pleines + dimmer porte l'intensité
        const c = fx.color;
        if ('r' in t) universe[a + t.r] = clamp(c[0] * f);
        if ('g' in t) universe[a + t.g] = clamp(c[1] * f);
        if ('b' in t) universe[a + t.b] = clamp(c[2] * f);
        if ('w' in t) universe[a + t.w] = clamp((c[3] || 0) * f);
        if (hasDim)   universe[a + t.dim] = masterLevel;
    }
    function refresh() { fixtures.forEach(writeFixture); }

    function setLevelLabel() {
        const l = document.getElementById('dmxLevel');
        if (l) l.textContent = Math.round(masterLevel / 255 * 100) + '%';
    }

    function setMaster(v) {
        masterLevel = Math.max(0, Math.min(255, v | 0));
        if (isBlack && masterLevel > 0) { isBlack = false; setBlackBtn(false); }
        refresh();
        setLevelLabel();
    }

    // --- Noir complet ---
    function setBlackBtn(on) {
        const b = document.getElementById('dmxBlackout');
        if (!b) return;
        b.classList.toggle('active', on);
        b.classList.toggle('btn-dark', on);
        b.classList.toggle('btn-outline-secondary', !on);
        b.textContent = on ? '💡 Rallumer' : 'Noir complet';
    }
    function blackout() { isBlack = true; setBlackBtn(true); refresh(); }
    function clearBlack() { if (isBlack) { isBlack = false; setBlackBtn(false); } }
    function toggleBlackout() {
        if (!running) return;
        if (isBlack) { clearBlack(); refresh(); } else { blackout(); }
    }

    // --- Couleurs ---
    function applyColor(target, name) {
        const c = PALETTE[name];
        if (!c || !running) return;
        cancelFades();
        clearBlack();
        if (target === 'all') { fixtures.forEach(fx => { fx.color = c.slice(); }); }
        else if (fixtures[target]) { fixtures[target].color = c.slice(); }
        refresh();
    }

    function warmWhite() {
        cancelFades();
        clearBlack();
        fixtures.forEach(fx => { fx.color = WARM.slice(); });
        refresh();
    }

    // Fin d'impro : noir instantané, puis rallumage blanc chaud après 3 s
    async function endOfImpro() {
        if (!running) return;
        cancelFades();
        blackout();
        await sleep(BLACK_HOLD_MS);
        fixtures.forEach(fx => { fx.color = WARM.slice(); });
        clearBlack();
        refresh();
    }

    // --- Chargement des projecteurs ---
    async function loadFixtures() {
        let list = null;
        try {
            const res = await fetch('data/fixtures.json.php?' + Date.now(), { cache: 'no-store' });
            if (res.ok) list = await res.json();
        } catch (e) { /* fallback ci-dessous */ }
        if (!Array.isArray(list) || !list.length) list = DEFAULT_FIXTURES;
        fixtures = list.map((f, i) => ({
            id: f.id || ('idx' + i), name: f.name, address: parseInt(f.address, 10),
            type: FIXTURE_TYPES[f.type] ? f.type : 'RGBW',
            color: WARM.slice(),
        }));
    }

    // --- Connexion ---
    function updateStatus(txt, ok) {
        const el = document.getElementById('dmxStatus');
        if (el) { el.textContent = txt; el.className = 'badge ' + (ok ? 'bg-success' : 'bg-secondary'); }
        const dis = !ok;
        ['dmxWarm', 'dmxBlackout', 'dmxMaster'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = dis; });
        const c = document.getElementById('dmxConnect');
        if (c) c.disabled = ok;
    }

    async function openPort(p) {
        port = p;
        await port.open({ baudRate: BAUD });
        writer = port.writable.getWriter();
        running = true;
        sendLoop();
        updateStatus('Connecté', true);
        warmWhite();
    }

    async function connect() {
        if (!('serial' in navigator)) {
            alert('Lumières : utilise Chrome ou Edge (Web Serial) sur le PC relié au boîtier.');
            return;
        }
        try {
            const p = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0403 }] });
            await openPort(p);
        } catch (e) { console.error(e); updateStatus('Échec', false); }
    }

    async function tryAutoReconnect() {
        if (!('serial' in navigator)) return;
        try {
            const ports = await navigator.serial.getPorts();
            if (ports && ports.length) { await openPort(ports[0]); }
        } catch (e) { /* l'utilisateur cliquera */ }
    }

    // --- Fondus (utilisés par les séquences) ---
    // Une seule animation à la fois par projecteur et pour le master ; une nouvelle remplace l'ancienne.
    const anims = new Map();               // clé ('fx:<id>' | 'master') → { tick, done }
    let animTimer = null;
    function runAnim(key, ms, apply) {
        return new Promise(resolve => {
            const prev = anims.get(key);
            if (prev) prev.done();
            const t0 = Date.now();
            const a = {
                tick() {
                    const k = ms > 0 ? Math.min(1, (Date.now() - t0) / ms) : 1;
                    apply(k);
                    if (k >= 1) a.done();
                },
                done() { if (anims.get(key) === a) anims.delete(key); resolve(); },
            };
            anims.set(key, a);
            a.tick();
            if (!animTimer) animTimer = setInterval(() => {
                anims.forEach(x => x.tick());
                refresh();
                if (!anims.size) { clearInterval(animTimer); animTimer = null; }
            }, 25);
        });
    }
    function cancelFades() { Array.from(anims.values()).forEach(a => a.done()); }

    // 'froid' | 'chaud' | … ou '#rrggbb' → [r, g, b, w]
    function colorValue(c) {
        if (PALETTE[c]) return PALETTE[c].slice();
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || '');
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 0] : WARM.slice();
    }

    function fadeColor(target, color, ms) {
        if (!running) return Promise.resolve();
        clearBlack();
        const to = colorValue(color);
        const list = target === 'all' ? fixtures : fixtures.filter(fx => fx.id === target);
        return Promise.all(list.map(fx => {
            const from = fx.color.slice();
            return runAnim('fx:' + fx.id, ms, k => { fx.color = from.map((v, i) => v + ((to[i] || 0) - v) * k); });
        })).then(refresh);
    }

    function fadeMaster(percent, ms) {
        if (!running) return Promise.resolve();
        const from = masterLevel, to = clamp(percent / 100 * 255);
        if (isBlack && to > 0) { isBlack = false; setBlackBtn(false); }
        return runAnim('master', ms, k => {
            masterLevel = clamp(from + (to - from) * k);
            const sl = document.getElementById('dmxMaster');
            if (sl) sl.value = String(masterLevel);
            setLevelLabel();
        }).then(refresh);
    }

    function lightsOn() { if (!running) return; clearBlack(); refresh(); }
    function blackoutNow() { if (!running) return; cancelFades(); blackout(); }

    // --- API ---
    window.DMX = {
        connect, endOfImpro, applyColor, toggleBlackout, warmWhite,
        fadeColor, fadeMaster, lightsOn, blackout: blackoutNow, cancelFades,
        getFixtures: () => fixtures.map(fx => ({ id: fx.id, name: fx.name })),
        isConnected: () => running,
    };

    const COLORS = [
        { k: 'froid', label: 'Blanc froid', css: '#cfe2ff', fg: '#000' },
        { k: 'chaud', label: 'Blanc chaud', css: '#ffc489', fg: '#000' },
        { k: 'rouge', label: 'Rouge',       css: '#ff3b3b', fg: '#fff' },
        { k: 'vert',  label: 'Vert',        css: '#35c759', fg: '#000' },
        { k: 'bleu',  label: 'Bleu',        css: '#2d6cdf', fg: '#fff' },
    ];

    function injectStyle() {
        if (document.getElementById('dmxStyle')) return;
        const s = document.createElement('style');
        s.id = 'dmxStyle';
        s.textContent = `
        #dmxMaster { -webkit-appearance:none; appearance:none; writing-mode:vertical-rl; direction:rtl;
            width:56px; min-height:240px; flex:1 1 auto; background:transparent; cursor:pointer; }
        #dmxMaster::-webkit-slider-runnable-track { width:22px; border-radius:12px;
            background:linear-gradient(to top,#38424d 0%,#eec41e 100%); border:1px solid rgba(0,0,0,.2); }
        #dmxMaster::-webkit-slider-thumb { -webkit-appearance:none; width:50px; height:28px; margin-left:-15px;
            border-radius:9px; background:#fff; border:2px solid #eec41e; box-shadow:0 2px 6px rgba(0,0,0,.35); }
        #dmxMaster::-moz-range-track { width:22px; border-radius:12px;
            background:linear-gradient(to top,#38424d,#eec41e); border:1px solid rgba(0,0,0,.2); }
        #dmxMaster::-moz-range-thumb { width:50px; height:28px; border-radius:9px; background:#fff; border:2px solid #eec41e; }
        #dmxMaster:disabled { opacity:.4; cursor:not-allowed; }
        .dmx-group { border:1px solid #dee2e6; border-radius:12px; padding:12px 14px; }
        .dmx-group--general { background:#fdf7db; border-color:#ecd77a; box-shadow:inset 0 0 0 1px #f3e49a; }
        .dmx-group--pars { background:#f6f7f9; margin-top:16px; }
        .dmx-group__title { font-size:.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em;
            color:#51657f; margin-bottom:10px; display:flex; align-items:center; gap:6px; }`;
        document.head.appendChild(s);
    }

    function makeColorRow(target, name, showLabel) {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2 flex-wrap';
        if (showLabel) {
            const lab = document.createElement('div');
            lab.textContent = name;
            lab.title = name;
            lab.style.cssText = 'width:92px;font-weight:700;font-size:.9rem;flex:0 0 auto;' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            row.appendChild(lab);
        }
        COLORS.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn';
            b.textContent = c.label;
            b.title = name + ' → ' + c.label;
            b.style.cssText = 'flex:1 1 90px;min-height:50px;background:' + c.css + ';color:' + c.fg +
                ';border:1px solid rgba(0,0,0,.15);font-size:.88rem;font-weight:600;padding:9px 6px;border-radius:10px;';
            b.addEventListener('click', () => applyColor(target, c.k));
            row.appendChild(b);
        });
        return row;
    }

    function buildControls() {
        const host = document.getElementById('dmxControls');
        if (!host) return;
        injectStyle();
        host.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:18px;align-items:stretch;';

        const left = document.createElement('div');
        left.style.cssText = 'flex:1 1 auto;min-width:0;';

        // Groupe GÉNÉRAL
        const gGen = document.createElement('div');
        gGen.className = 'dmx-group dmx-group--general';
        gGen.innerHTML = '<div class="dmx-group__title">🎛️ Général — tous les projecteurs</div>';
        gGen.appendChild(makeColorRow('all', 'Tous', false));
        left.appendChild(gGen);

        // Groupe PAR PROJECTEUR
        const gPars = document.createElement('div');
        gPars.className = 'dmx-group dmx-group--pars';
        gPars.innerHTML = '<div class="dmx-group__title">🔦 Par projecteur</div>';
        if (!fixtures.length) {
            const p = document.createElement('div');
            p.className = 'text-muted';
            p.style.fontSize = '.9rem';
            p.textContent = 'Aucun projecteur configuré (admin → Projecteurs).';
            gPars.appendChild(p);
        } else {
            fixtures.forEach((fx, i) => {
                const r = makeColorRow(i, fx.name, true);
                r.style.marginBottom = i < fixtures.length - 1 ? '8px' : '0';
                gPars.appendChild(r);
            });
        }
        left.appendChild(gPars);

        wrap.appendChild(left);

        // Colonne intensité
        const col = document.createElement('div');
        col.style.cssText = 'flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:space-between;' +
            'padding:12px 8px;border:1px solid #dee2e6;border-radius:12px;background:#f6f7f9;min-width:86px;';
        const top = document.createElement('div');
        top.style.cssText = 'text-align:center;margin-bottom:10px;';
        top.innerHTML = '<div style="font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;color:#51657f;">Intensité</div>' +
            '<div id="dmxLevel" style="font-size:1.25rem;font-weight:700;font-variant-numeric:tabular-nums;">100%</div>';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '255';
        slider.value = String(masterLevel);
        slider.id = 'dmxMaster';
        slider.disabled = !running;
        slider.addEventListener('input', e => { const a = anims.get('master'); if (a) a.done(); setMaster(parseInt(e.target.value, 10)); });
        col.appendChild(top);
        col.appendChild(slider);
        wrap.appendChild(col);

        host.appendChild(wrap);
        setLevelLabel();
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const c = document.getElementById('dmxConnect');
        if (c) c.addEventListener('click', connect);
        const w = document.getElementById('dmxWarm');
        if (w) w.addEventListener('click', warmWhite);
        const bl = document.getElementById('dmxBlackout');
        if (bl) bl.addEventListener('click', toggleBlackout);
        await loadFixtures();
        buildControls();
        tryAutoReconnect();
    });
})();
