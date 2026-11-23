// Interface Spotify personnalisée : connexion (OAuth PKCE), playlists, recherche, lecture.
// Nécessite un compte Spotify Premium et une app développeur (Client ID + Redirect URI).

(function () {
    const REDIRECT_URI = location.origin + location.pathname;   // à enregistrer dans l'app Spotify
    const SCOPES = [
        'streaming', 'user-read-email', 'user-read-private',
        'user-read-playback-state', 'user-modify-playback-state',
        'playlist-read-private', 'playlist-read-collaborative', 'user-library-read'
    ].join(' ');

    const LS = {
        clientId: 'spotify_client_id',
        verifier: 'spotify_pkce_verifier',
        access: 'spotify_access_token',
        refresh: 'spotify_refresh_token',
        expires: 'spotify_expires_at',
    };

    const $ = id => document.getElementById(id);
    let token = null, player = null, deviceId = null, sdkReady = false;
    let curTrackUri = null, progressTimer = null;

    function getClientId() { try { return localStorage.getItem(LS.clientId) || ''; } catch (e) { return ''; } }

    // ---------- PKCE ----------
    function randString(len) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const a = crypto.getRandomValues(new Uint8Array(len));
        return Array.from(a, x => chars[x % chars.length]).join('');
    }
    async function challenge(verifier) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    }

    async function login() {
        const clientId = getClientId();
        if (!clientId) return;
        const verifier = randString(80);
        localStorage.setItem(LS.verifier, verifier);
        const code_challenge = await challenge(verifier);
        const params = new URLSearchParams({
            response_type: 'code', client_id: clientId, scope: SCOPES,
            redirect_uri: REDIRECT_URI, code_challenge_method: 'S256', code_challenge,
        });
        location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
    }

    async function exchangeCode(code) {
        const clientId = getClientId();
        const verifier = localStorage.getItem(LS.verifier);
        const body = new URLSearchParams({
            grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
            client_id: clientId, code_verifier: verifier,
        });
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
        });
        if (!res.ok) throw new Error('Échec de connexion Spotify (' + res.status + ')');
        storeToken(await res.json());
    }

    async function refreshToken() {
        const clientId = getClientId();
        const rt = localStorage.getItem(LS.refresh);
        if (!rt) throw new Error('no refresh token');
        const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: clientId });
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
        });
        if (!res.ok) throw new Error('refresh failed');
        storeToken(await res.json());
    }

    function storeToken(data) {
        token = data.access_token;
        localStorage.setItem(LS.access, data.access_token);
        if (data.refresh_token) localStorage.setItem(LS.refresh, data.refresh_token);
        localStorage.setItem(LS.expires, String(Date.now() + (data.expires_in || 3600) * 1000));
    }

    async function ensureToken() {
        const exp = parseInt(localStorage.getItem(LS.expires) || '0', 10);
        if (!token) token = localStorage.getItem(LS.access);
        if (!token) throw new Error('no token');
        if (Date.now() > exp - 60000) { await refreshToken(); }
        return token;
    }

    function logout() {
        [LS.access, LS.refresh, LS.expires, LS.verifier].forEach(k => localStorage.removeItem(k));
        token = null;
        if (player) { try { player.disconnect(); } catch (e) {} }
        location.href = REDIRECT_URI;
    }

    // ---------- API ----------
    async function api(path, opts = {}) {
        await ensureToken();
        const url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
        opts.headers = Object.assign({ 'Authorization': 'Bearer ' + token }, opts.headers || {});
        let res = await fetch(url, opts);
        if (res.status === 401) { await refreshToken(); opts.headers['Authorization'] = 'Bearer ' + token; res = await fetch(url, opts); }
        if (res.status === 204) return null;
        if (!res.ok) throw new Error('API ' + res.status + ' ' + path);
        const txt = await res.text();
        return txt ? JSON.parse(txt) : null;
    }

    // ---------- Lecteur (Web Playback SDK) ----------
    window.onSpotifyWebPlaybackSDKReady = () => { sdkReady = true; maybeInitPlayer(); };

    function maybeInitPlayer() {
        if (!sdkReady || !token || player) return;
        player = new Spotify.Player({
            name: 'Registe — Spectacle',
            getOAuthToken: cb => { ensureToken().then(() => cb(token)).catch(() => cb(token)); },
            volume: 0.8,
        });
        player.addListener('ready', ({ device_id }) => {
            deviceId = device_id;
            // Rend ce navigateur actif pour la lecture
            api('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_ids: [device_id], play: false }) }).catch(() => {});
        });
        player.addListener('not_ready', () => { deviceId = null; });
        player.addListener('player_state_changed', onState);
        player.addListener('initialization_error', e => console.error('init', e));
        player.addListener('authentication_error', e => { console.error('auth', e); });
        player.addListener('account_error', () => showError('Compte non Premium : la lecture nécessite Spotify Premium.'));
        player.connect();
        startProgress();
    }

    function onState(state) {
        if (!state) return;
        const tr = state.track_window.current_track;
        curTrackUri = tr ? tr.uri : null;
        $('npTitle').textContent = tr ? tr.name : '—';
        $('npArtist').textContent = tr ? tr.artists.map(a => a.name).join(', ') : '';
        $('npCover').src = tr && tr.album.images[0] ? tr.album.images[0].url : '';
        $('playBtn').textContent = state.paused ? '▶' : '⏸';
        $('durTime').textContent = fmt(state.duration);
        updateSeek(state.position, state.duration);
        markPlaying();
    }

    function startProgress() {
        if (progressTimer) clearInterval(progressTimer);
        progressTimer = setInterval(async () => {
            if (!player) return;
            const s = await player.getCurrentState();
            if (s && !s.paused) updateSeek(s.position, s.duration);
        }, 1000);
    }

    let seekDragging = false;
    function updateSeek(pos, dur) {
        if (seekDragging || !dur) return;
        $('seek').value = String(Math.round(pos / dur * 1000));
        $('curTime').textContent = fmt(pos);
    }

    function fmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    async function playUris(uris) {
        if (!deviceId) { showToast('Lecteur pas encore prêt…'); return; }
        await api('/me/player/play?device_id=' + deviceId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris })
        });
    }

    // ---------- UI ----------
    async function loadMe() {
        try { const me = await api('/me'); $('me').textContent = me.display_name || me.id; } catch (e) {}
    }

    async function loadPlaylists() {
        const box = $('playlists');
        try {
            const data = await api('/me/playlists?limit=50');
            box.innerHTML = '';
            (data.items || []).forEach(pl => {
                const el = document.createElement('div');
                el.className = 'pl';
                const img = pl.images && pl.images[0] ? pl.images[0].url : '';
                el.innerHTML = `<img src="${img}" alt=""><div class="t">${escapeHtml(pl.name)}</div>`;
                el.addEventListener('click', () => { setActivePl(el); openPlaylist(pl); });
                box.appendChild(el);
            });
            if (!data.items || !data.items.length) box.innerHTML = '<div class="hint" style="padding:8px;">Aucune playlist.</div>';
        } catch (e) { box.innerHTML = '<div class="hint" style="padding:8px;">Erreur de chargement.</div>'; }
    }
    function setActivePl(el) {
        document.querySelectorAll('#playlists .pl').forEach(x => x.classList.remove('active'));
        if (el) el.classList.add('active');
    }

    async function openPlaylist(pl) {
        const content = $('content');
        content.innerHTML = '<h1>' + escapeHtml(pl.name) + '</h1><div class="center">Chargement…</div>';
        try {
            const data = await api('/playlists/' + pl.id + '/tracks?limit=100');
            const tracks = (data.items || []).map(i => i.track).filter(t => t && t.uri);
            renderTracks(pl.name, tracks, tracks.map(t => t.uri));
        } catch (e) { content.innerHTML = '<div class="center">Erreur de chargement.</div>'; }
    }

    function renderTracks(title, tracks, contextUris) {
        const content = $('content');
        content.innerHTML = '<h1>' + escapeHtml(title) + '</h1>';
        if (!tracks.length) { content.innerHTML += '<div class="center">Aucun titre.</div>'; return; }
        const list = document.createElement('div');
        tracks.forEach((t, idx) => {
            const row = document.createElement('div');
            row.className = 'track';
            row.dataset.uri = t.uri;
            const img = t.album && t.album.images && t.album.images[0] ? t.album.images[0].url : '';
            row.innerHTML = `<img src="${img}" alt="">
                <div class="meta"><div class="title">${escapeHtml(t.name)}</div>
                <div class="artist">${escapeHtml((t.artists || []).map(a => a.name).join(', '))}</div></div>
                <div class="dur">${fmt(t.duration_ms || 0)}</div>`;
            row.addEventListener('click', () => {
                // lit à partir de ce titre, dans l'ordre de la liste
                playUris(contextUris.slice(idx));
            });
            list.appendChild(row);
        });
        content.appendChild(list);
        markPlaying();
    }

    function markPlaying() {
        document.querySelectorAll('.track').forEach(r => r.classList.toggle('playing', r.dataset.uri === curTrackUri));
    }

    let searchTimer = null;
    function onSearch(q) {
        clearTimeout(searchTimer);
        if (!q.trim()) return;
        searchTimer = setTimeout(async () => {
            try {
                const data = await api('/search?type=track&limit=30&q=' + encodeURIComponent(q));
                const tracks = (data.tracks && data.tracks.items) || [];
                setActivePl(null);
                renderTracks('Résultats : ' + q, tracks, tracks.map(t => t.uri));
            } catch (e) {}
        }, 350);
    }

    function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function showError(msg) { const e = $('setupError'); if (e) { e.style.display = 'block'; e.textContent = msg; } }
    function showToast(msg) { const t = $('npArtist'); if (t) { const old = t.textContent; t.textContent = msg; setTimeout(() => { if (t.textContent === msg) t.textContent = old; }, 1500); } }

    // ---------- Démarrage ----------
    function showSetup() {
        $('app').style.display = 'none';
        $('setup').style.display = 'block';
        $('redirectUri').textContent = REDIRECT_URI;
        if (getClientId()) { $('setupClientId').style.display = 'none'; $('setupLogin').style.display = 'block'; }
        else { $('setupClientId').style.display = 'block'; $('setupLogin').style.display = 'none'; }
    }

    async function startApp() {
        $('setup').style.display = 'none';
        $('app').style.display = 'flex';
        maybeInitPlayer();
        wirePlayer();
        await loadMe();
        await loadPlaylists();
    }

    function wirePlayer() {
        $('playBtn').onclick = () => player && player.togglePlay();
        $('nextBtn').onclick = () => player && player.nextTrack();
        $('prevBtn').onclick = () => player && player.previousTrack();
        $('vol').oninput = e => player && player.setVolume(e.target.value / 100);
        const seek = $('seek');
        seek.addEventListener('input', () => { seekDragging = true; });
        seek.addEventListener('change', async () => {
            const s = await player.getCurrentState();
            if (s) await player.seek(Math.round(seek.value / 1000 * s.duration));
            seekDragging = false;
        });
        $('search').addEventListener('input', e => onSearch(e.target.value));
        $('logoutBtn').onclick = logout;
    }

    async function init() {
        // Boutons de l'écran de setup
        $('saveClientId').onclick = () => {
            const v = $('clientIdInput').value.trim();
            if (v) { localStorage.setItem(LS.clientId, v); showSetup(); }
        };
        $('resetClientId').onclick = e => { e.preventDefault(); localStorage.removeItem(LS.clientId); showSetup(); };
        $('loginBtn').onclick = login;

        const params = new URLSearchParams(location.search);
        if (params.get('error')) { showSetup(); showError('Connexion refusée : ' + params.get('error')); return; }
        if (params.get('code')) {
            try {
                await exchangeCode(params.get('code'));
                history.replaceState({}, '', REDIRECT_URI); // nettoie l'URL
                await startApp();
                return;
            } catch (e) { showSetup(); showError(e.message); return; }
        }
        // Déjà connecté ?
        if (localStorage.getItem(LS.access)) {
            try { await ensureToken(); await startApp(); return; } catch (e) { /* token invalide */ }
        }
        showSetup();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
