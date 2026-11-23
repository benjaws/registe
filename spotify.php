<?php require __DIR__."/auth.php"; require_login_page(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Musique — Spotify</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body { margin:0; height:100vh; display:flex; flex-direction:column;
            background:#0b0d10; color:#e9edf1; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; overflow:hidden; }
        a { color:#1db954; }
        button { font-family:inherit; cursor:pointer; }
        .green { background:#1db954; color:#04150b; border:0; border-radius:999px; font-weight:700; padding:12px 22px; font-size:1rem; }
        .green:hover { background:#1ed760; }

        /* Écran de connexion / setup */
        #setup { margin:auto; max-width:560px; padding:30px; text-align:center; }
        #setup h1 { font-size:1.6rem; }
        #setup .card { background:#15181d; border:1px solid #242a31; border-radius:16px; padding:24px; margin-top:16px; text-align:left; }
        #setup input { width:100%; padding:12px; border-radius:8px; border:1px solid #343c45; background:#0f1216; color:#fff; margin-top:6px; }
        #setup code { background:#0f1216; padding:3px 7px; border-radius:6px; word-break:break-all; border:1px solid #242a31; }
        .muted { color:#8b97a3; font-size:.9rem; }

        /* App */
        #app { flex:1; display:none; min-height:0; }
        #topbar { display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid #1d2228; }
        #topbar .brand { font-weight:800; letter-spacing:.02em; }
        #topbar .spacer { flex:1; }
        #me { font-size:.9rem; color:#b9c3cd; }
        #search { flex:1; max-width:420px; padding:10px 14px; border-radius:999px; border:1px solid #343c45; background:#0f1216; color:#fff; }
        .btn-ghost { background:transparent; border:1px solid #343c45; color:#e9edf1; border-radius:999px; padding:8px 14px; }

        #main { display:flex; min-height:0; height:calc(100% - 56px - 84px); }
        #sidebar { width:260px; border-right:1px solid #1d2228; overflow:auto; padding:12px; flex:0 0 auto; }
        #sidebar h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:#8b97a3; margin:8px 6px; }
        .pl { padding:10px 12px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:10px; }
        .pl:hover { background:#161a1f; }
        .pl.active { background:#1f2834; }
        .pl img { width:36px; height:36px; border-radius:5px; object-fit:cover; background:#222; flex:0 0 auto; }
        .pl .t { font-size:.92rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        #content { flex:1; overflow:auto; padding:16px 20px; min-width:0; }
        #content h1 { font-size:1.4rem; margin:0 0 14px; }
        .track { display:flex; align-items:center; gap:12px; padding:10px; border-radius:8px; cursor:pointer; }
        .track:hover { background:#161a1f; }
        .track.playing { background:#13241a; }
        .track img { width:44px; height:44px; border-radius:5px; object-fit:cover; background:#222; flex:0 0 auto; }
        .track .meta { min-width:0; flex:1; }
        .track .title { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .track .artist { font-size:.85rem; color:#8b97a3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .track .dur { color:#8b97a3; font-variant-numeric:tabular-nums; font-size:.85rem; }

        /* Lecteur */
        #player { height:84px; border-top:1px solid #1d2228; display:flex; align-items:center; gap:16px; padding:0 18px; background:#0d1014; }
        #npCover { width:56px; height:56px; border-radius:6px; background:#222; object-fit:cover; flex:0 0 auto; }
        #npInfo { min-width:160px; max-width:260px; }
        #npTitle { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #npArtist { font-size:.85rem; color:#8b97a3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #transport { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; }
        .tbtns { display:flex; align-items:center; gap:18px; }
        .tbtns button { background:transparent; border:0; color:#e9edf1; font-size:1.3rem; }
        #playBtn { width:52px; height:52px; border-radius:50%; background:#fff; color:#000; font-size:1.4rem; display:flex; align-items:center; justify-content:center; }
        #seekwrap { display:flex; align-items:center; gap:10px; width:100%; max-width:560px; font-size:.75rem; color:#8b97a3; }
        #seek, #vol { width:100%; accent-color:#1db954; }
        #volwrap { display:flex; align-items:center; gap:8px; width:140px; flex:0 0 auto; }
        .hint { color:#8b97a3; font-size:.9rem; }
        .center { margin:auto; text-align:center; color:#8b97a3; padding:40px; }
    </style>
</head>
<body>

    <!-- Écran de connexion / configuration -->
    <div id="setup">
        <h1>🎵 Musique — Spotify</h1>
        <p class="muted">Interface de lecture reliée à ton compte Spotify (Premium requis).</p>

        <div class="card" id="setupClientId" style="display:none;">
            <strong>Configuration (une seule fois)</strong>
            <ol class="muted" style="padding-left:18px;line-height:1.7;">
                <li>Va sur <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> et crée une app.</li>
                <li>Dans les réglages de l'app, ajoute cette <strong>Redirect URI</strong> exacte :<br>
                    <code id="redirectUri"></code></li>
                <li>Copie le <strong>Client ID</strong> de l'app et colle-le ici :</li>
            </ol>
            <input id="clientIdInput" placeholder="Client ID Spotify" autocomplete="off">
            <div style="margin-top:12px;"><button class="green" id="saveClientId">Enregistrer</button></div>
        </div>

        <div class="card" id="setupLogin" style="display:none;text-align:center;">
            <button class="green" id="loginBtn">Se connecter à Spotify</button>
            <p class="muted" style="margin-top:14px;">Client ID enregistré. <a href="#" id="resetClientId">Changer le Client ID</a></p>
        </div>

        <div class="card" id="setupError" style="display:none;color:#ff8080;"></div>
    </div>

    <!-- Application -->
    <div id="app">
        <div id="topbar">
            <span class="brand">🎵 Registe · Spotify</span>
            <input id="search" placeholder="Rechercher un titre, un artiste…">
            <div class="spacer"></div>
            <span id="me"></span>
            <button class="btn-ghost" id="logoutBtn">Déconnexion</button>
        </div>
        <div id="main">
            <div id="sidebar">
                <h2>Playlists</h2>
                <div id="playlists"></div>
            </div>
            <div id="content">
                <div class="center">Choisis une playlist ou lance une recherche.</div>
            </div>
        </div>
        <div id="player">
            <img id="npCover" alt="">
            <div id="npInfo">
                <div id="npTitle">—</div>
                <div id="npArtist"></div>
            </div>
            <div id="transport">
                <div class="tbtns">
                    <button id="prevBtn" title="Précédent">⏮</button>
                    <button id="playBtn" title="Lecture/Pause">▶</button>
                    <button id="nextBtn" title="Suivant">⏭</button>
                </div>
                <div id="seekwrap">
                    <span id="curTime">0:00</span>
                    <input id="seek" type="range" min="0" max="1000" value="0">
                    <span id="durTime">0:00</span>
                </div>
            </div>
            <div id="volwrap">🔉 <input id="vol" type="range" min="0" max="100" value="80"></div>
        </div>
    </div>

    <script src="https://sdk.scdn.co/spotify-player.js"></script>
    <script src="spotify.js"></script>
</body>
</html>
