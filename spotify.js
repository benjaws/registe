// Intégration Spotify : connexion (OAuth PKCE), playlists, recherche, lecture.
// Nécessite un compte Spotify Premium et une app développeur (Client ID + Redirect URI).
//
// Deux usages :
//  - spotify.php : page de configuration + retour OAuth (Redirect URI à enregistrer chez Spotify)
//  - regie.php   : mini-lecteur intégré dans la carte « Musique » (#spMini)

(function () {
    // La Redirect URI pointe toujours sur spotify.php, quelle que soit la page qui lance la connexion
    const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
    const REDIRECT_URI = BASE + 'spotify.php';
    const RETURN_URL = BASE + 'regie.php';
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
    const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

    const $ = id => document.getElementById(id);
    let token = null;

    function getClientId() { return lsGet(LS.clientId) || ''; }
    function isConnected() { return !!lsGet(LS.access) && !!getClientId(); }

    // ---------- PKCE / jetons ----------
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
        lsSet(LS.verifier, verifier);
        const params = new URLSearchParams({
            response_type: 'code', client_id: clientId, scope: SCOPES,
            redirect_uri: REDIRECT_URI, code_challenge_method: 'S256', code_challenge: await challenge(verifier),
        });
        location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
    }

    async function tokenRequest(body) {
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body)
        });
        if (!res.ok) throw new Error('Échec de connexion Spotify (' + res.status + ')');
        storeToken(await res.json());
    }
    const exchangeCode = code => tokenRequest({
        grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
        client_id: getClientId(), code_verifier: lsGet(LS.verifier) || '',
    });
    async function refreshToken() {
        const rt = lsGet(LS.refresh);
        if (!rt) throw new Error('no refresh token');
        await tokenRequest({ grant_type: 'refresh_token', refresh_token: rt, client_id: getClientId() });
    }

    function storeToken(data) {
        token = data.access_token;
        lsSet(LS.access, data.access_token);
        if (data.refresh_token) lsSet(LS.refresh, data.refresh_token);
        lsSet(LS.expires, String(Date.now() + (data.expires_in || 3600) * 1000));
    }

    async function ensureToken() {
        const exp = parseInt(lsGet(LS.expires) || '0', 10);
        if (!token) token = lsGet(LS.access);
        if (!token) throw new Error('no token');
        if (Date.now() > exp - 60000) await refreshToken();
        return token;
    }

    function clearTokens() {
        [LS.access, LS.refresh, LS.expires, LS.verifier].forEach(lsDel);
        token = null;
    }

    async function api(path, opts = {}) {
        await ensureToken();
        const url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
        opts.headers = Object.assign({ 'Authorization': 'Bearer ' + token }, opts.headers || {});
        let res = await fetch(url, opts);
        if (res.status === 401) { await refreshToken(); opts.headers['Authorization'] = 'Bearer ' + token; res = await fetch(url, opts); }
        if (res.status === 204) return null;
        if (!res.ok) { const e = new Error('API ' + res.status + ' ' + path); e.status = res.status; throw e; }
        const txt = await res.text();
        return txt ? JSON.parse(txt) : null;
    }

    function fmt(ms) { const s = Math.floor((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    const artists = t => (t.artists || []).map(a => a.name).join(', ');
    const cover = t => (t.album && t.album.images && t.album.images.length) ? t.album.images[t.album.images.length - 1].url : '';

    // =====================================================================
    //  Page de configuration (spotify.php)
    // =====================================================================
    async function initSetupPage() {
        const show = id => ['setupClientId', 'setupLogin', 'setupDone'].forEach(x => { $(x).style.display = x === id ? 'block' : 'none'; });
        const showError = msg => { $('setupError').style.display = 'block'; $('setupError').textContent = msg; };
        const refresh = () => {
            $('redirectUri').textContent = REDIRECT_URI;
            if (!getClientId()) show('setupClientId');
            else if (isConnected()) show('setupDone');
            else show('setupLogin');
        };

        $('saveClientId').onclick = () => {
            const v = $('clientIdInput').value.trim();
            if (v) { lsSet(LS.clientId, v); refresh(); }
        };
        document.querySelectorAll('.resetClientId').forEach(a => a.onclick = e => {
            e.preventDefault(); clearTokens(); lsDel(LS.clientId); refresh();
        });
        $('loginBtn').onclick = login;
        $('logoutBtn').onclick = () => { clearTokens(); refresh(); };

        const params = new URLSearchParams(location.search);
        if (params.get('error')) { refresh(); showError('Connexion refusée : ' + params.get('error')); return; }
        if (params.get('code')) {
            try {
                await exchangeCode(params.get('code'));
                lsSet('registe_music_tab', 'spotify');
                location.replace(RETURN_URL);   // retour direct à la régie
                return;
            } catch (e) { history.replaceState({}, '', REDIRECT_URI); refresh(); showError(e.message); return; }
        }
        refresh();
    }

    // =====================================================================
    //  Mini-lecteur intégré (regie.php)
    // =====================================================================
    function initMini() {
        const root = $('spMini');
        let player = null, deviceId = null, sdkLoaded = false, activated = false;
        let curTrackUri = null, seekDragging = false, progressTimer = null;
        let playlists = [];

        // --- Onglets Local / Spotify ---
        const tabs = document.querySelectorAll('[data-music-tab]');
        function setTab(name) {
            tabs.forEach(b => b.classList.toggle('active', b.dataset.musicTab === name));
            $('musicLocalPane').style.display = name === 'local' ? '' : 'none';
            root.style.display = name === 'spotify' ? '' : 'none';
            lsSet('registe_music_tab', name);
            if (name === 'spotify') start();
        }
        tabs.forEach(b => b.addEventListener('click', () => setTab(b.dataset.musicTab)));

        // --- États ---
        function showState(name) {
            ['spOff', 'spOn'].forEach(id => { $(id).style.display = id === name ? '' : 'none'; });
        }
        function msg(text) {
            const m = $('spMsg');
            m.textContent = text || '';
            m.style.display = text ? '' : 'none';
        }

        let started = false;
        async function start() {
            if (started) return;
            if (!isConnected()) { showState('spOff'); return; }
            try { await ensureToken(); } catch (e) { clearTokens(); showState('spOff'); return; }
            started = true;
            showState('spOn');
            loadSdk();
            loadMe();
            loadPlaylists();
        }

        $('spConnect').onclick = () => {
            if (getClientId()) login();
            else location.href = REDIRECT_URI;    // pas encore configuré → page de config
        };
        $('spLogout').onclick = e => {
            e.preventDefault();
            if (player) { try { player.disconnect(); } catch (err) {} player = null; deviceId = null; }
            clearTokens();
            started = false;
            showState('spOff');
        };

        // --- Web Playback SDK (chargé seulement si connecté) ---
        function loadSdk() {
            if (sdkLoaded) return;
            sdkLoaded = true;
            window.onSpotifyWebPlaybackSDKReady = initPlayer;
            const s = document.createElement('script');
            s.src = 'https://sdk.scdn.co/spotify-player.js';
            document.head.appendChild(s);
        }

        function initPlayer() {
            if (player) return;
            player = new Spotify.Player({
                name: 'Régiste — Régie',
                getOAuthToken: cb => { ensureToken().then(() => cb(token)).catch(() => cb(token)); },
                volume: $('spVol').value / 100,
            });
            player.addListener('ready', ({ device_id }) => { deviceId = device_id; msg(''); });
            player.addListener('not_ready', () => { deviceId = null; });
            player.addListener('player_state_changed', onState);
            player.addListener('initialization_error', e => msg('Lecteur indisponible dans ce navigateur.'));
            player.addListener('authentication_error', () => msg('Session Spotify expirée : reconnecte-toi.'));
            player.addListener('account_error', () => msg('La lecture nécessite un compte Spotify Premium.'));
            player.connect();
            if (progressTimer) clearInterval(progressTimer);
            progressTimer = setInterval(async () => {
                if (!player) return;
                const s = await player.getCurrentState();
                if (s && !s.paused) updateSeek(s.position, s.duration);
            }, 1000);
        }

        function activate() {
            // Les navigateurs exigent un geste utilisateur pour démarrer l'audio
            if (player && !activated && player.activateElement) { activated = true; player.activateElement(); }
        }

        function onState(state) {
            if (!state) return;
            const tr = state.track_window.current_track;
            curTrackUri = tr ? tr.uri : null;
            $('spTitle').textContent = tr ? tr.name : '—';
            $('spArtist').textContent = tr ? artists(tr) : '';
            const img = tr ? cover(tr) : '';
            $('spCover').src = img; $('spCover').style.visibility = img ? 'visible' : 'hidden';
            $('spPlay').textContent = state.paused ? '▶' : '⏸';
            $('spDur').textContent = fmt(state.duration);
            updateSeek(state.position, state.duration);
            markPlaying();
        }

        function updateSeek(pos, dur) {
            if (seekDragging || !dur) return;
            $('spSeek').value = String(Math.round(pos / dur * 1000));
            $('spCur').textContent = fmt(pos);
        }

        async function play(body) {
            activate();
            if (!deviceId) { msg('Lecteur Spotify pas encore prêt…'); return; }
            try {
                await api('/me/player/play?device_id=' + deviceId, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                });
                msg('');
            } catch (e) { msg('Impossible de lancer la lecture (' + (e.status || '?') + ').'); }
        }

        // --- Transport ---
        $('spPlay').onclick = async () => {
            activate();
            if (!player) return;
            const s = await player.getCurrentState();
            if (s) player.togglePlay();
            else if (deviceId) {
                // rien de chargé sur ce lecteur : on y transfère la lecture en cours
                api('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_ids: [deviceId], play: true }) }).catch(() => msg('Choisis un titre dans la liste.'));
            }
        };
        $('spNext').onclick = () => player && player.nextTrack();
        $('spPrev').onclick = () => player && player.previousTrack();
        $('spVol').oninput = e => player && player.setVolume(e.target.value / 100);
        const seek = $('spSeek');
        seek.addEventListener('input', () => { seekDragging = true; });
        seek.addEventListener('change', async () => {
            const s = player && await player.getCurrentState();
            if (s) await player.seek(Math.round(seek.value / 1000 * s.duration));
            seekDragging = false;
        });

        // --- Listes ---
        async function loadMe() {
            try { const me = await api('/me'); $('spMe').textContent = me.display_name || me.id; } catch (e) {}
        }

        async function loadPlaylists() {
            const sel = $('spPlaylist');
            try {
                const data = await api('/me/playlists?limit=50');
                playlists = data.items || [];
                sel.innerHTML = '<option value="">— Choisir une playlist —</option><option value="__liked">❤️ Titres likés</option>'
                    + playlists.filter(Boolean).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
                const last = lsGet('registe_sp_playlist');
                if (last && sel.querySelector(`option[value="${CSS.escape(last)}"]`)) { sel.value = last; openSelected(); }
            } catch (e) { sel.innerHTML = '<option value="">Erreur de chargement</option>'; }
        }

        $('spPlaylist').addEventListener('change', () => { $('spSearch').value = ''; openSelected(); });

        async function openSelected() {
            const id = $('spPlaylist').value;
            lsSet('registe_sp_playlist', id);
            if (!id) { renderTracks([], null, 'Choisis une playlist ou lance une recherche.'); return; }
            listLoading();
            try {
                if (id === '__liked') {
                    const data = await api('/me/tracks?limit=50');
                    renderTracks((data.items || []).map(i => i.track).filter(t => t && t.uri), null);
                } else {
                    let data;
                    try { data = await api('/playlists/' + id + '/tracks?limit=100'); }
                    catch (e) { data = await api('/playlists/' + id + '/items?limit=100'); }
                    const tracks = (data.items || []).map(i => i.track || i.item).filter(t => t && t.uri && t.type !== 'episode');
                    renderTracks(tracks, 'spotify:playlist:' + id);
                }
            } catch (e) { renderTracks([], null, 'Erreur de chargement.'); }
        }

        let searchTimer = null;
        $('spSearch').addEventListener('input', e => {
            clearTimeout(searchTimer);
            const q = e.target.value.trim();
            if (!q) { openSelected(); return; }
            searchTimer = setTimeout(async () => {
                listLoading();
                try {
                    let data;
                    try { data = await api('/search?type=track&limit=20&q=' + encodeURIComponent(q)); }
                    catch (err) { data = await api('/search?type=track&limit=10&q=' + encodeURIComponent(q)); }
                    renderTracks((data.tracks && data.tracks.items) || [], null, 'Aucun résultat.');
                } catch (err) { renderTracks([], null, 'Erreur de recherche.'); }
            }, 350);
        });

        function listLoading() { $('spList').innerHTML = '<div class="sp-empty">Chargement…</div>'; }

        function renderTracks(tracks, contextUri, emptyText) {
            const list = $('spList');
            list.innerHTML = '';
            if (!tracks.length) { list.innerHTML = `<div class="sp-empty">${esc(emptyText || 'Aucun titre.')}</div>`; return; }
            const uris = tracks.map(t => t.uri);
            tracks.forEach((t, idx) => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'sp-track';
                row.dataset.uri = t.uri;
                const img = cover(t);
                row.innerHTML = `${img ? `<img src="${esc(img)}" alt="">` : '<span class="sp-noimg"></span>'}
                    <span class="sp-meta"><span class="sp-t">${esc(t.name)}</span><span class="sp-a">${esc(artists(t))}</span></span>
                    <span class="sp-d">${fmt(t.duration_ms)}</span>`;
                row.addEventListener('click', () => {
                    // playlist : on joue dans son contexte (enchaîne la suite) ; sinon la liste affichée
                    if (contextUri) play({ context_uri: contextUri, offset: { uri: t.uri } });
                    else play({ uris: uris.slice(idx) });
                });
                list.appendChild(row);
            });
            markPlaying();
        }

        function markPlaying() {
            document.querySelectorAll('#spList .sp-track').forEach(r => r.classList.toggle('playing', r.dataset.uri === curTrackUri));
        }

        // Commandes accessibles depuis ailleurs (musique de transition, raccourcis clavier)
        window.RegisteSpotify = {
            pause: () => player && player.pause(),
            isActive: () => root.style.display !== 'none' && $('spOn').style.display !== 'none',
            toggle: () => $('spPlay').click(),
            next: () => $('spNext').click(),
            prev: () => $('spPrev').click(),
            volume: delta => {
                const v = $('spVol');
                v.value = String(Math.max(0, Math.min(100, +v.value + delta)));
                v.dispatchEvent(new Event('input'));
                return +v.value;
            },
            focusSearch: () => { $('spSearch').focus(); $('spSearch').select(); },
            play: () => { activate(); if (player) player.resume(); },
            // Lien open.spotify.com/… ou URI spotify:… (titre, playlist, album)
            playLink: link => {
                const m = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|playlist|album)[/:]([A-Za-z0-9]+)/.exec(link || '');
                if (!m) { msg('Lien Spotify non reconnu.'); return; }
                const uri = 'spotify:' + m[1] + ':' + m[2];
                return play(m[1] === 'track' ? { uris: [uri] } : { context_uri: uri });
            },
            isReady: () => !!deviceId,
            setTab,
        };

        setTab(lsGet('registe_music_tab') === 'spotify' ? 'spotify' : 'local');
        start();   // lecteur prêt même depuis l'onglet Local (utile aux séquences)
    }

    document.addEventListener('DOMContentLoaded', () => {
        if ($('spMini')) initMini();
        else if ($('setupClientId')) initSetupPage();
    });
})();
