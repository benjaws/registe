// Raccourcis clavier de la régie : piloter le spectacle sans souris.
// Chaque raccourci déclenche le bouton correspondant (même logique qu'un clic).

(function () {
    const $ = id => document.getElementById(id);

    // Clique un bouton seulement s'il est visible et actif
    function press(id) {
        const b = $(id);
        if (!b || b.disabled || b.offsetParent === null) return false;
        b.click();
        flash(b);
        return true;
    }
    function flash(el) {
        el.classList.add('key-flash');
        setTimeout(() => el.classList.remove('key-flash'), 180);
    }

    // Petit message temporaire en bas de l'écran
    let toastTimer = null;
    function toast(text) {
        let t = $('keyToast');
        if (!t) { t = document.createElement('div'); t.id = 'keyToast'; document.body.appendChild(t); }
        t.textContent = text;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 900);
    }

    const sp = () => window.RegisteSpotify && window.RegisteSpotify.isActive() ? window.RegisteSpotify : null;
    const localAudio = () => $('musicPlayer');

    const music = {
        toggle() {
            if (sp()) { sp().toggle(); return; }
            const a = localAudio();
            if (!a || !a.src) return;
            if (a.paused) a.play().catch(() => {}); else a.pause();
            toast(a.paused ? '⏸ Pause' : '▶ Lecture');
        },
        next() {
            if (sp()) { sp().next(); toast('⏭ Suivant'); return; }
            const a = localAudio(); if (a && a.src) { a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); toast('+10 s'); }
        },
        prev() {
            if (sp()) { sp().prev(); toast('⏮ Précédent'); return; }
            const a = localAudio(); if (a && a.src) { a.currentTime = Math.max(0, a.currentTime - 10); toast('−10 s'); }
        },
        volume(delta) {
            if (sp()) { toast('🔉 ' + sp().volume(delta * 100) + ' %'); return; }
            const a = localAudio(); if (!a) return;
            a.volume = Math.max(0, Math.min(1, Math.round((a.volume + delta) * 100) / 100));
            toast('🔉 ' + Math.round(a.volume * 100) + ' %');
        },
    };

    // touche → action  (e.key en minuscule ; les flèches gardent leur nom)
    const KEYS = {
        ' ':          () => music.toggle(),
        'arrowright': () => music.next(),
        'arrowleft':  () => music.prev(),
        'arrowup':    () => music.volume(+0.1),
        'arrowdown':  () => music.volume(-0.1),
        'm':          () => press('stopMusicBtn') && toast('🔇 Fondu musique'),
        't':          () => {
            if (!window.RegisteSpotify) return;
            const next = $('spMini').style.display !== 'none' ? 'local' : 'spotify';
            window.RegisteSpotify.setTab(next);
            toast(next === 'spotify' ? '🎵 Spotify' : '🎵 Local');
        },
        '/':          () => { if (sp()) sp().focusSearch(); },
        'v':          () => { const f = $('selectCatForm'); if (f) { f.requestSubmit(); toast('✓ Catégorie validée'); } },
        'j':          () => press('playBtn') && toast('▶ Jouer'),
        's':          () => press('stopBtn') && toast('⏹ Stopper'),
        'b':          () => press('dmxWarm') && toast('💡 Base (blanc chaud)'),
        'n':          () => press('dmxBlackout') && toast('🌑 Noir complet / rallumer'),
        'g':          () => { if (window.Sequences) window.Sequences.go(); },
        'escape':     () => { const S = window.Sequences; if (S && S.state()) { S.stop(); toast('⏹ Séquence arrêtée'); } },
        '?':          () => showHelp(),
    };

    // Partagé avec le dock Mirabox (dock.js) : mêmes actions que le clavier
    window.RegisteKeys = { music, press, toast, KEYS };

    function isTyping(el) {
        if (!el) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        return tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(el.type);
    }

    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
        const el = e.target;
        if (e.key === 'Escape' && isTyping(el)) { el.blur(); return; }
        if (isTyping(el)) return;
        const key = e.key.toLowerCase();
        // Sur un curseur (volume, position) les flèches gardent leur comportement natif
        if (el && el.type === 'range' && key.startsWith('arrow')) return;
        // 1 … 9 : séquences (e.code pour marcher aussi sur AZERTY sans Maj)
        const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
        if (digit && window.Sequences) {
            const i = +digit[1] - 1, seq = window.Sequences.list()[i];
            if (seq) { e.preventDefault(); window.Sequences.runIndex(i); toast('🎬 ' + seq.name); }
            return;
        }
        const action = KEYS[key];
        if (!action) return;
        e.preventDefault();                 // évite p. ex. qu'Espace re-clique le bouton qui a le focus
        if (el && el !== document.body && el.blur && key === ' ') el.blur();
        action();
    });

    function showHelp() {
        const m = $('keysModal');
        if (m && window.bootstrap) bootstrap.Modal.getOrCreateInstance(m).toggle();
    }
    document.addEventListener('DOMContentLoaded', () => {
        const b = $('keysHelpBtn');
        if (b) b.addEventListener('click', showHelp);
    });
})();
