<?php require __DIR__ . '/auth.php'; $logged = current_account(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — la régie tout-en-un pour vos spectacles d'impro</title>
    <meta name="description" content="Régiste : chrono synchronisé, lumières DMX, musique et tirages d'impro. L'outil de régie des petites compagnies de théâtre d'improvisation.">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
    <style>
        .nav-bar { display:flex; align-items:center; gap:14px; padding:18px 0; }
        .nav-bar .brand { font-size:1.4rem; }
        .hero { padding:60px 0 40px; text-align:center; }
        .hero h1 { font-size:clamp(2rem,5vw,3.4rem); font-weight:800; letter-spacing:-.03em; line-height:1.05; color:var(--accent-ink); }
        .hero .lead { font-size:1.2rem; color:var(--muted); max-width:640px; margin:18px auto 28px; }
        .hero .cta { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
        .pill { display:inline-block; background:#fff7d6; color:#8a6d00; border:1px solid #ecd77a; padding:6px 14px; border-radius:999px; font-weight:600; font-size:.85rem; }
        .features { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px; margin:30px 0 60px; }
        .feature { background:#fff; border:1px solid var(--border); border-radius:var(--radius); padding:22px; box-shadow:var(--shadow); }
        .feature .ic { font-size:1.9rem; }
        .feature h3 { font-size:1.1rem; font-weight:700; margin:10px 0 6px; }
        .feature p { color:var(--muted); font-size:.95rem; margin:0; }
        .footer { text-align:center; color:var(--muted); padding:30px 0 50px; font-size:.9rem; }
        .usedby { display:flex; flex-direction:column; align-items:center; gap:14px; padding:38px 20px; margin:10px 0 40px; background:#fff; border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); }
        .usedby .label { text-transform:uppercase; letter-spacing:.2em; font-size:.75rem; font-weight:700; color:var(--muted); }
        .usedby img { height:64px; width:auto; }
        .usedby a.studio { display:inline-flex; align-items:center; }
        .credit { margin-top:6px; font-size:.95rem; color:var(--accent-ink); }
        .credit a { color:var(--accent-ink); font-weight:600; }
        .mock { max-width:760px; margin:10px auto 0; border-radius:18px; border:1px solid var(--border); box-shadow:var(--shadow-hover); overflow:hidden; background:#0b0d10; color:#eee; }
        .mock .bar { display:flex; gap:6px; padding:10px 14px; background:#15181d; }
        .mock .bar span { width:11px; height:11px; border-radius:50%; background:#3a4049; }
        .mock .bar .url { margin-left:10px; background:#23272e; color:#8b97a3; font-size:.72rem; padding:3px 12px; border-radius:999px; }
        .mock .screen { padding:22px 20px; text-align:left; }
        .mock .screen .big { font-size:2.9rem; font-weight:800; letter-spacing:-.02em; color:#eec41e; font-variant-numeric:tabular-nums; line-height:1; }
        .mock .screen .sub { color:#8b97a3; text-transform:uppercase; letter-spacing:.2em; font-size:.72rem; margin-top:8px; }
        .mock-top { color:#c7d0da; font-size:.92rem; margin-bottom:14px; }
        .mock-top strong { color:#eec41e; }
        .mock-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .mock-tile { background:#15181d; border:1px solid #23272e; border-radius:14px; padding:18px; text-align:center; }
        .swatches { display:flex; gap:9px; justify-content:center; margin-bottom:14px; }
        .swatches span { width:32px; height:32px; border-radius:9px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
        .meter { height:9px; background:#23272e; border-radius:999px; overflow:hidden; margin-bottom:12px; }
        .meter i { display:block; height:100%; background:linear-gradient(90deg,#38424d,#eec41e); }
        .mock-foot { margin-top:14px; color:#8b97a3; font-size:.85rem; display:flex; align-items:center; gap:8px; }
        .mock-foot b { color:#c7d0da; font-weight:600; }
        .mock-foot .spot { margin-left:auto; background:#1db954; color:#04210f; padding:2px 10px; border-radius:999px; font-size:.72rem; font-weight:700; }
        @media (max-width:480px){ .mock-grid { grid-template-columns:1fr; } }
    </style>
</head>
<body>
<div class="container" style="max-width:1080px;">

    <nav class="nav-bar">
        <div class="brand"><img src="logo.svg" class="brand-logo" alt=""> Régiste</div>
        <div class="header-actions">
            <?php if ($logged): ?>
                <a href="regie.php" class="btn btn-primary btn-sm">Ouvrir la régie</a>
            <?php else: ?>
                <a href="login.php" class="btn btn-outline-primary btn-sm">Se connecter</a>
                <a href="signup.php" class="btn btn-primary btn-sm">Créer un compte</a>
            <?php endif; ?>
        </div>
    </nav>

    <section class="hero">
        <span class="pill">Pour les compagnies d'impro</span>
        <h1>La régie de vos spectacles,<br>depuis votre navigateur.</h1>
        <p class="lead">Chrono synchronisé sur tablette, lumières DMX, musique et tirages de catégories&nbsp;: Régiste met toute la technique de votre spectacle d'improvisation dans une seule interface, simple à piloter en direct.</p>
        <div class="cta">
            <?php if ($logged): ?>
                <a href="regie.php" class="btn btn-primary btn-lg">Ouvrir ma régie</a>
            <?php else: ?>
                <a href="signup.php" class="btn btn-primary btn-lg">Créer un compte gratuit</a>
                <a href="login.php" class="btn btn-outline-primary btn-lg">Se connecter</a>
            <?php endif; ?>
        </div>

        <div class="mock">
            <div class="bar"><span></span><span></span><span></span><div class="url">registe.ch</div></div>
            <div class="screen">
                <div class="mock-top">🎲 Catégorie&nbsp;: <strong>Comparée</strong> · 2 impros · durée 2:00</div>
                <div class="mock-grid">
                    <div class="mock-tile">
                        <div class="big">1:30</div>
                        <div class="sub">Chrono en cours</div>
                    </div>
                    <div class="mock-tile">
                        <div class="swatches">
                            <span style="background:#f4e6bd"></span>
                            <span style="background:#ffd24d"></span>
                            <span style="background:#e4405f"></span>
                            <span style="background:#3aa0ff"></span>
                        </div>
                        <div class="meter"><i style="width:68%"></i></div>
                        <div class="sub">Lumières DMX</div>
                    </div>
                </div>
                <div class="mock-foot">▶ <b>Musique de transition</b><span class="spot">Spotify</span></div>
            </div>
        </div>
    </section>

    <section class="features">
        <div class="feature"><div class="ic">⏱️</div><h3>Chrono synchronisé</h3><p>Un écran tablette côté scène, parfaitement synchro avec la régie. Couleurs d'alerte sur les dernières secondes.</p></div>
        <div class="feature"><div class="ic">💡</div><h3>Lumières DMX</h3><p>Pilotez vos projecteurs (RGB, RGBW…) directement depuis le navigateur : couleurs, intensité, noir de fin d'impro.</p></div>
        <div class="feature"><div class="ic">🎵</div><h3>Musique</h3><p>Vos musiques de transition et votre lecteur, au bon moment. Connexion Spotify en option.</p></div>
        <div class="feature"><div class="ic">🎲</div><h3>Catégories & thèmes</h3><p>Tirez vos catégories d'impro et générez des thèmes, avec durées et historique de la soirée.</p></div>
    </section>

    <div class="text-center" style="margin-bottom:60px;">
        <?php if (!$logged): ?>
            <a href="signup.php" class="btn btn-primary btn-lg">Démarrer avec ma compagnie</a>
            <p class="text-muted mt-2" style="font-size:.9rem;">Création sur simple demande — validée par l'équipe.</p>
        <?php endif; ?>
    </div>

    <div class="usedby">
        <div class="label">Utilisé par</div>
        <a href="https://studio-sous-gare.ch" target="_blank" rel="noopener" class="studio">
            <img src="studio-sous-gare.webp" alt="Studio Sous-Gare">
        </a>
        <p class="credit mb-0">
            Un produit conçu et utilisé par le <a href="https://studio-sous-gare.ch" target="_blank" rel="noopener">Studio Sous-Gare</a>,<br>
            créé par <a href="https://studio-sous-gare.ch/benjamin-boury-jamot.html" target="_blank" rel="noopener">Benjamin Boury-Jamot</a>.
        </p>
    </div>

    <div class="footer">
        Régiste — un outil pour les compagnies de théâtre d'improvisation. ·
        <a href="login.php">Connexion</a>
    </div>
</div>
</body>
</html>
