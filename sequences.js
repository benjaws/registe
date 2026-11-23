// Séquences personnalisées (cues) : enchaînements de lumière, son et chrono.
// - Régie : panneau #seqPanel (lancer, GO, arrêter) + déclencheurs au « Jouer » / « Stopper »
// - Admin : réutilise Sequences.describe / Sequences.STEP_TYPES pour l'éditeur

(function () {
    const BASE = location.pathname.includes('/admin/') ? '../' : '';
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const PRESETS = { froid: 'Blanc froid', chaud: 'Blanc chaud', rouge: 'Rouge', vert: 'Vert', bleu: 'Bleu' };
    const PRESET_CSS = { froid: '#cfe2ff', chaud: '#ffc489', rouge: '#ff3b3b', vert: '#35c759', bleu: '#2d6cdf' };

    const STEP_TYPES = {
        light:      { label: '💡 Couleur',            group: 'Lumière' },
        intensity:  { label: '🔆 Intensité',          group: 'Lumière' },
        blackout:   { label: '🌑 Noir complet',        group: 'Lumière' },
        lights_on:  { label: '💡 Rallumer',            group: 'Lumière' },
        music:      { label: '🎵 Jouer un mp3',        group: 'Son' },
        music_stop: { label: '🔇 Couper le son (fondu)', group: 'Son' },
        spotify:    { label: '🟢 Spotify',             group: 'Son' },
        chrono:     { label: '⏱️ Chrono',              group: 'Impro' },
        wait:       { label: '⏳ Attendre',            group: 'Temps' },
        go:         { label: '✋ Attendre GO',          group: 'Temps' },
    };
    const TRIGGERS = { '': 'Manuel', start: 'Au « Jouer »', stop: 'Au « Stopper »' };

    const sec = v => (+v || 0).toLocaleString('fr-CH', { maximumFractionDigits: 2 }) + ' s';

    // Description lisible d'une étape (fixtures : [{id,name}] pour nommer la cible)
    function describe(step, fixtures) {
        const fxName = id => id === 'all' ? 'tous' : ((fixtures || []).find(f => f.id === id) || {}).name || 'projecteur ?';
        const fade = step.fade > 0 ? ` en ${sec(step.fade)}` + (step.parallel ? ' (en parallèle)' : '') : '';
        switch (step.type) {
            case 'light':      return `Couleur ${PRESETS[step.color] || step.color} → ${fxName(step.target)}${fade}`;
            case 'intensity':  return `Intensité ${step.level} %${fade}`;
            case 'blackout':   return 'Noir complet';
            case 'lights_on':  return 'Rallumer';
            case 'wait':       return `Attendre ${sec(step.seconds)}`;
            case 'go':         return 'Attendre GO';
            case 'music':      return `Jouer « ${step.file || '?'} »` + (step.start ? ` à ${sec(step.start)}` : '') + (step.volume < 100 ? `, volume ${step.volume} %` : '');
            case 'music_stop': return `Couper le son en ${sec(step.fade)}`;
            case 'spotify':    return 'Spotify : ' + ({ play: 'lecture', pause: 'pause', next: 'titre suivant', link: 'jouer ' + (step.link || '?') }[step.action] || step.action);
            case 'chrono':     return step.action === 'stop' ? 'Stopper (fin d\'impro)' : 'Jouer (lance le chrono)';
        }
        return step.type;
    }

    // =====================================================================
    //  Moteur d'exécution (régie)
    // =====================================================================
    let sequences = [];
    let current = null;          // { seq, cancelled, step, waitingGo, goResolve, timers }
    let inStep = false;          // vrai pendant qu'une étape clique Jouer/Stopper (évite les boucles)
    const listeners = new Set();
    const notify = () => listeners.forEach(fn => fn());

    async function load() {
        try {
            const res = await fetch(BASE + 'data/sequences.json.php?' + Date.now(), { cache: 'no-store' });
            sequences = res.ok ? await res.json() : [];
        } catch (e) { sequences = []; }
        notify();
        return sequences;
    }

    function sleep(run, ms) {
        return new Promise(resolve => {
            if (run.cancelled) return resolve();
            const t = setTimeout(() => { run.wakers.delete(w); resolve(); }, ms);
            const w = () => { clearTimeout(t); resolve(); };
            run.wakers.add(w);
        });
    }
    function waitGo(run) {
        return new Promise(resolve => {
            run.waitingGo = true;
            const w = () => { run.waitingGo = false; run.wakers.delete(w); resolve(); };
            run.goResolve = w;
            run.wakers.add(w);
            notify();
        });
    }

    function click(id) {
        const b = $(id);
        if (!b || b.disabled || b.offsetParent === null) return;
        inStep = true;
        try { b.click(); } finally { inStep = false; }
    }

    function playLocal(step) {
        const a = $('musicPlayer');
        if (!a || !step.file) return;
        const sel = $('musicSelect');
        if (sel && Array.from(sel.options).some(o => o.value === step.file)) sel.value = step.file;
        a.src = BASE + 'music/' + step.file;
        a.volume = Math.max(0, Math.min(1, (step.volume ?? 100) / 100));
        const go = () => { try { a.currentTime = step.start || 0; } catch (e) {} a.play().catch(() => {}); };
        if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    }

    function stopSound(seconds) {
        const ms = Math.max(0, seconds * 1000);
        if (typeof window.fadeOutAudio === 'function') {
            window.fadeOutAudio($('audioTransition'), ms);
            window.fadeOutAudio($('musicPlayer'), ms);
        } else ['audioTransition', 'musicPlayer'].forEach(id => { const a = $(id); if (a) a.pause(); });
        if (window.RegisteSpotify) window.RegisteSpotify.pause();
    }

    async function execStep(run, step) {
        const D = window.DMX;
        const fadeMs = (step.fade || 0) * 1000;
        const maybeWait = p => step.parallel ? null : p;
        switch (step.type) {
            case 'light':      if (D) await maybeWait(D.fadeColor(step.target, step.color, fadeMs)); break;
            case 'intensity':  if (D) await maybeWait(D.fadeMaster(step.level, fadeMs)); break;
            case 'blackout':   if (D) D.blackout(); break;
            case 'lights_on':  if (D) D.lightsOn(); break;
            case 'wait':       await sleep(run, step.seconds * 1000); break;
            case 'go':         await waitGo(run); break;
            case 'music':      playLocal(step); break;
            case 'music_stop': stopSound(step.fade); break;
            case 'spotify': {
                const S = window.RegisteSpotify;
                if (!S) break;
                if (step.action === 'pause') S.pause();
                else if (step.action === 'next') S.next();
                else if (step.action === 'link') await S.playLink(step.link);
                else S.play();
                break;
            }
            case 'chrono':     click(step.action === 'stop' ? 'stopBtn' : 'playBtn'); break;
        }
    }

    async function run(seq) {
        stop();
        const r = { seq, cancelled: false, step: -1, waitingGo: false, goResolve: null, wakers: new Set() };
        current = r;
        notify();
        do {
            const t0 = Date.now();
            for (let i = 0; i < seq.steps.length && !r.cancelled; i++) {
                r.step = i;
                notify();
                try { await execStep(r, seq.steps[i]); }
                catch (e) { console.error('[Séquence]', seq.name, seq.steps[i], e); }
            }
            // garde-fou : une boucle sans durée ne doit pas bloquer la page
            if (seq.loop && !r.cancelled && Date.now() - t0 < 100) await sleep(r, 100);
        } while (seq.loop && !r.cancelled);
        if (current === r) { current = null; notify(); }
    }

    function stop() {
        if (!current) return;
        const r = current;
        r.cancelled = true;
        r.wakers.forEach(w => w());
        if (window.DMX && window.DMX.cancelFades) window.DMX.cancelFades();
        current = null;
        notify();
    }

    function go() { if (current && current.waitingGo && current.goResolve) current.goResolve(); }

    // Déclencheurs automatiques. Retourne true si une séquence a pris le relais.
    function runTrigger(name) {
        if (inStep) return true;                      // déclenché par une séquence : elle gère déjà la suite
        if (name === 'stop') stop();                  // « Stopper » arrête toujours la séquence en cours
        const seq = sequences.find(s => s.trigger === name);
        if (!seq) return false;
        run(seq);
        return true;
    }

    function runIndex(i) { const s = sequences[i]; if (s) run(s); return !!s; }

    window.Sequences = {
        STEP_TYPES, TRIGGERS, PRESETS, PRESET_CSS, describe,
        load, run, stop, go, runTrigger, runIndex,
        list: () => sequences,
        state: () => current,
        onChange: fn => listeners.add(fn),
    };

    // =====================================================================
    //  Panneau de la régie
    // =====================================================================
    function initPanel() {
        const panel = $('seqPanel');
        if (!panel) return;
        const listEl = $('seqList'), status = $('seqStatus');

        function render() {
            const fixtures = window.DMX ? window.DMX.getFixtures() : [];
            if (!sequences.length) {
                listEl.innerHTML = '<div class="seq-empty">Aucune séquence. Crée tes enchaînements dans <a href="admin/#sequences">Admin → Séquences</a>.</div>';
            } else {
                listEl.innerHTML = sequences.map((s, i) => {
                    const running = current && current.seq.id === s.id;
                    const badges = [
                        i < 9 ? `<kbd>${i + 1}</kbd>` : '',
                        s.trigger ? `<span class="seq-badge">${esc(TRIGGERS[s.trigger])}</span>` : '',
                        s.loop ? '<span class="seq-badge" title="En boucle">🔁</span>' : '',
                    ].join('');
                    return `<button type="button" class="seq-btn${running ? ' running' : ''}" data-i="${i}"
                        title="${esc(s.steps.map(st => describe(st, fixtures)).join(' → '))}">
                        <span class="seq-name">${esc(s.name)}</span><span class="seq-badges">${badges}</span></button>`;
                }).join('');
            }
            if (current) {
                const s = current.seq, st = s.steps[current.step];
                status.style.display = '';
                $('seqNow').innerHTML = `<strong>▶ ${esc(s.name)}</strong> — étape ${current.step + 1}/${s.steps.length}`
                    + (st ? ` : ${esc(describe(st, fixtures))}` : '');
                const pct = s.steps.length ? Math.round((current.step + 1) / s.steps.length * 100) : 0;
                $('seqBar').style.width = pct + '%';
                const g = $('seqGo');
                g.disabled = !current.waitingGo;
                g.classList.toggle('waiting', !!current.waitingGo);
            } else {
                status.style.display = 'none';
            }
        }

        listEl.addEventListener('click', e => {
            const b = e.target.closest('.seq-btn');
            if (b) runIndex(+b.dataset.i);
        });
        $('seqGo').addEventListener('click', go);
        $('seqStop').addEventListener('click', stop);
        listeners.add(render);
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        if ($('seqPanel')) { initPanel(); load(); }
    });
})();
