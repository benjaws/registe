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

    </style>
</head>
<body>

    <!-- Écran de connexion / configuration -->
    <div id="setup">
        <h1>🎵 Musique — Spotify</h1>
        <p class="muted">Connexion de la régie à ton compte Spotify (Premium requis).</p>

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
            <p class="muted" style="margin-top:14px;">Client ID enregistré. <a href="#" class="resetClientId">Changer le Client ID</a></p>
        </div>

        <div class="card" id="setupDone" style="display:none;text-align:center;">
            <p><strong>✓ Connecté à Spotify.</strong></p>
            <p class="muted">Le lecteur se trouve dans la carte « Musique » de la régie (onglet Spotify).</p>
            <a class="green" href="regie.php" style="display:inline-block;text-decoration:none;">Retour à la régie</a>
            <p class="muted" style="margin-top:14px;"><a href="#" id="logoutBtn">Déconnexion</a> · <a href="#" class="resetClientId">Changer le Client ID</a></p>
        </div>

        <div class="card" id="setupError" style="display:none;color:#ff8080;"></div>
    </div>

    <script src="spotify.js?v=2"></script>
</body>
</html>
