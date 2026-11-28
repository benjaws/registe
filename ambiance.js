// Ambiance : on tape deux mots entendus (« hôpital abandonné », « banquet médiéval »)
// → preset lumière (DMX.setScene : couleurs, intensité, effet) + nappe sonore synthétisée.
// Résolution côté serveur (ambiance.php) : presets → ambiances apprises → Gemini.
// Des fichiers dans nappes/ remplacent les couches synthétiques (voir nappes/LISEZMOI.md).

(function () {
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const SRC = { preset: 'preset', appris: 'déjà apprise', gemini: 'inventée par Gemini', 'approché': 'preset approché' };
    const EFFECT = { static: 'fixe', fire: 'flammes', candle: 'bougie', pulse: 'respiration', wave: 'vagues',
                     heartbeat: 'battement', flicker: 'néon', storm: 'orage' };
    let presets = [], nappes = [], current = null, sugg = [], sel = -1;

    // =====================================================================
    //  Nappes sonores (Web Audio)
    // =====================================================================
    let ctx = null, master = null, bus = null, jobs = [], noiseBuf = null;
    function audio() {
        if (!ctx) {
            ctx = new AudioContext();
            master = ctx.createGain();
            master.gain.value = ($('ambVol') ? $('ambVol').value : 60) / 100;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    function noiseBuffer() {
        if (!noiseBuf) {
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0); let b = 0;
            for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 3; }
        }
        return noiseBuf;
    }
    function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; s.start(0, Math.random() * 3); return s; }
    function lfo(param, freq, depth, center) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq; g.gain.value = depth; param.value = center;
        o.connect(g).connect(param); o.start();
    }
    const filt = (type, f, q = 1) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    // Tâche répétée à intervalle aléatoire, arrêtée au changement d'ambiance
    function every(min, max, fn) {
        const job = { alive: true };
        const tick = () => { if (!job.alive) return; fn(ctx.currentTime + 0.05); setTimeout(tick, (min + Math.random() * (max - min)) * 1000); };
        setTimeout(tick, Math.random() * min * 1000);
        jobs.push(job);
    }
    function blip(out, t, { f0, f1 = f0, dur, type = 'sine', gain = 0.5 }) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    function burst(out, t, { dur, f = 3000, q = 1, gain = 0.4 }) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuffer();
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(filt('bandpass', f, q)).connect(g).connect(out); s.start(t, Math.random() * 3); s.stop(t + dur + 0.02);
    }
    const CHORDS = { sombre: [55, 82.4, 130.8], chaud: [65.4, 98, 164.8], tendu: [55, 77.8, 116.5],
                     clair: [110, 165, 220], etrange: [61.7, 87.3, 92.5], joyeux: [98, 123.5, 146.8] };
    const LAYERS = {
        drone(out, mood) {
            const lp = filt('lowpass', 600, 2); lp.connect(out); lfo(lp.frequency, 0.05, 250, 600);
            (CHORDS[mood] || CHORDS.sombre).forEach((f, i) => [-3, 3].forEach(det => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = f;
                o.detune.value = det + (mood === 'etrange' ? Math.random() * 30 : 0);
                g.gain.value = 0.12; o.connect(g).connect(lp); o.start();
            }));
        },
        wind(out) { const bp = filt('bandpass', 500, 0.8), g = ctx.createGain();
            noise().connect(bp).connect(g).connect(out); lfo(bp.frequency, 0.07, 300, 600); lfo(g.gain, 0.11, 0.35, 0.55); },
        rain(out) { const g = ctx.createGain(); g.gain.value = 0.35;
            noise().connect(filt('highpass', 1200)).connect(filt('lowpass', 7000)).connect(g).connect(out);
            every(0.03, 0.15, t => burst(out, t, { dur: 0.03, f: 2500 + Math.random() * 3000, q: 3, gain: 0.15 })); },
        fire(out) { const g = ctx.createGain();
            noise().connect(filt('lowpass', 250)).connect(g).connect(out); lfo(g.gain, 0.6, 0.2, 0.6);
            every(0.04, 0.35, t => burst(out, t, { dur: 0.01 + Math.random() * 0.03, f: 1500 + Math.random() * 4000, q: 2, gain: 0.5 + Math.random() * 0.5 })); },
        hum(out) { const lp = filt('lowpass', 400); lp.connect(out);
            [[50, 'sawtooth', 0.08], [100, 'sine', 0.12], [150, 'sine', 0.03]].forEach(([f, ty, a]) => {
                const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = f; g.gain.value = a; o.connect(g).connect(lp); o.start(); }); },
        heartbeat(out) { let next = ctx.currentTime + 0.2;
            every(0.25, 0.25, () => { while (next < ctx.currentTime + 0.5) {
                blip(out, next, { f0: 70, f1: 40, dur: 0.18, gain: 0.9 }); blip(out, next + 0.28, { f0: 60, f1: 35, dur: 0.16, gain: 0.6 }); next += 1.1; } }); },
        waves(out) { const lp = filt('lowpass', 700), g = ctx.createGain();
            noise().connect(lp).connect(g).connect(out); lfo(g.gain, 0.09, 0.45, 0.5); lfo(lp.frequency, 0.09, 400, 800); },
        crowd(out) { [350, 700, 1100, 1700].forEach((f, i) => { const bp = filt('bandpass', f, 4), g = ctx.createGain();
            noise().connect(bp).connect(g).connect(out); lfo(g.gain, 1.3 + i * 0.7, 0.25, 0.35); lfo(bp.frequency, 0.3 + i * 0.2, f * 0.2, f); }); },
        birds(out) { every(0.6, 3.5, t => { const n = 1 + (Math.random() * 4 | 0), f = 2500 + Math.random() * 2500;
            for (let k = 0; k < n; k++) blip(out, t + k * 0.11, { f0: f, f1: f * (1.2 + Math.random() * 0.4), dur: 0.08, gain: 0.12 }); }); },
        bells(out) { every(5, 12, t => { const f = [196, 220, 261.6, 293.7][Math.random() * 4 | 0];
            [1, 2.76, 5.4, 8.93].forEach((m, k) => blip(out, t, { f0: f * m, dur: 4 / (k + 1), gain: 0.2 / (k + 1) })); }); },
        drip(out) { every(0.5, 2.5, t => blip(out, t, { f0: 900 + Math.random() * 500, f1: 300, dur: 0.12, gain: 0.35 })); },
        clock(out) { let k = 0; every(1, 1, t => burst(out, t, { dur: 0.03, f: (k++ % 2) ? 2600 : 3400, q: 8, gain: 0.8 })); },
    };
    const files = {};
    async function fileLayer(out, name, gain) {
        try {
            const buf = files[name] || (files[name] = await fetch('nappes/' + encodeURIComponent(name))
                .then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)));
            const s = ctx.createBufferSource(), g = ctx.createGain();
            s.buffer = buf; s.loop = true; g.gain.value = gain; s.connect(g).connect(out); s.start();
        } catch (e) { console.warn('Nappe', name, e); }
    }
    function fadeOutBus(fade) {
        jobs.forEach(j => j.alive = false); jobs = [];
        if (!bus) return;
        const old = bus, now = ctx.currentTime; bus = null;
        old.gain.cancelScheduledValues(now); old.gain.setValueAtTime(old.gain.value, now); old.gain.linearRampToValueAtTime(0, now + fade);
        setTimeout(() => old.disconnect(), (fade + 0.5) * 1000);
    }
    function playSound(p) {
        audio();
        const fade = Math.max(1.5, +p.fade || 2), now = ctx.currentTime;
        fadeOutBus(fade);
        bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master); bus.gain.linearRampToValueAtTime(1, now + fade);
        const snd = p.sound || {};
        // fichier nommé d'après l'ambiance (« medieval-taverne.mp3 ») : remplace toute la nappe
        const own = nappes.find(f => norm(f).startsWith(norm(p.id) + '-') || norm(f).split('.')[0] === norm(p.id));
        if (own) return fileLayer(bus, own, 0.9);
        Object.entries(snd.layers || {}).forEach(([name, g]) => {
            const lg = ctx.createGain(); lg.gain.value = g * 0.6; lg.connect(bus);
            const file = nappes.find(f => norm(f).startsWith(name));   // « crowd-bistrot.mp3 » remplace la couche crowd
            if (file) fileLayer(lg, file, 1); else if (LAYERS[name]) LAYERS[name](lg, snd.mood);
        });
        setSoundBtn(true);
    }
    function stopSound(fade = 2) { if (ctx) fadeOutBus(fade); setSoundBtn(false); }
    function setSoundBtn(on) { const b = $('ambStopSound'); if (b) b.disabled = !on; }

    // =====================================================================
    //  Régie
    // =====================================================================
    function msg(text, kind) {
        const m = $('ambMsg'); if (!m) return;
        m.textContent = text || ''; m.className = 'amb-msg' + (kind ? ' amb-msg--' + kind : '');
    }
    function showCurrent(p, source) {
        current = p;
        const n = $('ambNow'); if (!n) return;
        if (!p) { n.innerHTML = '<span class="text-muted">Aucune ambiance</span>'; return; }
        const layers = Object.keys((p.sound || {}).layers || {}).join(', ');
        n.innerHTML = `<div class="amb-now__name">${esc(p.emoji || '')} ${esc(p.name)}</div>
            <div class="amb-sw">${(p.colors || []).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</div>
            <div class="amb-now__info">${esc(EFFECT[p.effect] || p.effect)} · ${p.intensity} % · son : ${esc(layers || '—')}
            ${source ? ' · <em>' + esc(SRC[source] || source) + '</em>' : ''}</div>`;
    }

    async function apply(body) {
        audio(); // le geste (Entrée / clic / touche du dock) débloque le son
        msg(body.text ? `Recherche « ${body.text} »…` : '…');
        let r;
        try {
            const res = await fetch('ambiance.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            r = await res.json();
        } catch (e) { return msg('Serveur injoignable', 'err'); }
        if (r.error) return msg(r.error, 'err');
        const p = r.preset;
        const lit = window.DMX && window.DMX.setScene(p);
        playSound(p);
        showCurrent(p, r.source);
        const notes = [r.ms + ' ms'];
        if (!lit) notes.push('lumières non connectées');
        if (r.warning) notes.push(r.warning);
        msg(notes.join(' · '), (r.warning || !lit) ? 'warn' : '');
        const q = $('ambInput'); if (q) q.value = '';
        showSugg([]);
        if (r.source === 'gemini') load();
        if (window.RegisteKeys) window.RegisteKeys.toast('🎭 ' + p.name);
    }

    function showSugg(list) {
        sugg = list; sel = -1;
        const box = $('ambSugg'); if (!box) return;
        box.innerHTML = list.map(s => `<button type="button" class="btn btn-sm btn-outline-secondary" data-amb="${esc(s.id)}">${esc(s.emoji)} ${esc(s.name)}</button>`).join('');
    }
    function renderGrid() {
        const g = $('ambGrid'); if (!g) return;
        g.innerHTML = presets.map(p => `<button type="button" class="amb-chip${p.learned_from ? ' amb-chip--learned' : ''}" data-amb="${esc(p.id)}"
            title="${esc((p.keywords || []).join(', '))}${p.learned_from ? '\n(apprise — clic droit pour oublier)' : ''}">
            ${esc(p.emoji || '')} ${esc(p.name)}<span class="amb-sw">${(p.colors || []).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span></button>`).join('');
        const c = $('ambCount'); if (c) c.textContent = presets.length;
    }
    async function load() {
        try {
            const [r, n] = await Promise.all([
                fetch('ambiance.php', { cache: 'no-store' }).then(x => x.json()),
                fetch('nappes/index.php', { cache: 'no-store' }).then(x => x.ok ? x.json() : []).catch(() => []),
            ]);
            presets = r.presets || []; nappes = Array.isArray(n) ? n : [];
            const b = $('ambLlm');
            if (b) { b.textContent = r.llm ? 'Gemini · ' + r.model : 'presets seuls';
                     b.className = 'badge ' + (r.llm ? 'bg-success' : 'bg-secondary');
                     b.title = r.llm ? 'Les lieux inconnus sont inventés par Gemini puis retenus'
                                     : 'GEMINI_API_KEY absente du .env : seuls les presets répondent'; }
            renderGrid();
        } catch (e) { console.error('Ambiance', e); }
    }

    // Ambiance qui continue à jouer : coupée par « Stopper », « Couper le son » et la tablette
    function hookSound() {
        const orig = window.stopAllSound;
        if (typeof orig === 'function') window.stopAllSound = function () { orig.apply(this, arguments); stopSound(1.5); };
        const stop = $('stopBtn');
        if (stop) stop.addEventListener('click', () => { stopSound(2.5); showCurrent(null); });
    }

    function bind() {
        const f = $('ambForm'), q = $('ambInput');
        if (!f || !q) return;
        let t;
        q.addEventListener('input', () => {
            clearTimeout(t);
            const v = q.value.trim();
            t = setTimeout(async () => {
                if (!v) return showSugg([]);
                try { showSugg(await fetch('ambiance.php?q=' + encodeURIComponent(v)).then(r => r.json())); } catch (e) {}
            }, 120);
        });
        q.addEventListener('keydown', e => {
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugg.length) {
                e.preventDefault();
                sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + sugg.length) % sugg.length;
                Array.from($('ambSugg').children).forEach((b, i) => b.classList.toggle('active', i === sel));
            }
            if (e.key === 'Tab' && sugg.length && !e.shiftKey) { e.preventDefault(); apply({ id: sugg[Math.max(sel, 0)].id }); }
        });
        f.addEventListener('submit', e => {
            e.preventDefault();
            const v = q.value.trim(); if (!v) return;
            apply(sel >= 0 ? { id: sugg[sel].id } : { text: v });
        });
        $('ambCard').addEventListener('click', e => { const b = e.target.closest('[data-amb]'); if (b) apply({ id: b.dataset.amb }); });
        $('ambGrid').addEventListener('contextmenu', async e => {
            const b = e.target.closest('.amb-chip--learned'); if (!b) return;
            e.preventDefault();
            await fetch('ambiance.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'forget', id: b.dataset.amb }) });
            msg('Ambiance oubliée'); load();
        });
        $('ambStopSound').addEventListener('click', () => { stopSound(2); msg('Nappe coupée'); });
        $('ambVol').addEventListener('input', e => { if (master) master.gain.value = e.target.value / 100; });
        // A : aller au champ Ambiance (même hors du champ, comme les autres raccourcis)
        if (window.RegisteKeys) window.RegisteKeys.KEYS['a'] = focus;
    }
    function focus() { const q = $('ambInput'); if (q) { q.focus(); q.select(); } }

    window.Ambiance = {
        apply, stopSound, focus,
        list: () => presets,
        current: () => current,
        isPlaying: () => !!bus,
    };

    document.addEventListener('DOMContentLoaded', () => { bind(); hookSound(); load(); });
})();
