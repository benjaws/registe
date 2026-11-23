<?php require __DIR__ . '/auth.php'; require_login_page(); $acct = current_account(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="styles.css" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
</head>
<body>
<div class="container-fluid py-4">
  <div style="max-width:1400px;margin:0 auto;">
    <header class="app-header">
      <div class="brand"><img src="logo.svg" class="brand-logo" alt=""> Régiste</div>
      <div class="brand-sub">Régie de spectacle d'impro</div>
      <div class="header-actions">
        <a href="chrono.php" target="_blank" class="btn btn-outline-primary btn-sm">⏱️ Chrono (écran)</a>
        <a href="spotify.php" target="_blank" class="btn btn-outline-primary btn-sm">🎵 Spotify</a>
        <a href="admin/" class="btn btn-outline-primary btn-sm">⚙️ Admin</a>
        <?php if (is_superadmin()): ?><a href="superadmin.php" class="btn btn-outline-primary btn-sm">👑 Super-admin</a><?php endif; ?>
        <a href="account.php" class="btn btn-outline-primary btn-sm">👤 <?= htmlspecialchars($acct['company']) ?></a>
        <a href="logout.php" class="btn btn-outline-primary btn-sm">Déconnexion</a>
      </div>
    </header>
    <div class="row g-4">

      <!-- Colonne gauche : impro + musique -->
      <div class="col-12 col-lg-4">
        <div class="card p-4 shadow-sm h-100">
          <form id="selectCatForm" class="mb-3">
            <div class="mb-2">
              <label>Catégorie</label>
              <select class="form-select" name="cat" id="catSelect" required></select>
            </div>
            <div class="text-end">
              <button type="submit" class="btn btn-primary">Valider</button>
            </div>
          </form>
          <div id="result" class="mt-3" style="display:none;">
            <h3>Durée : <span id="duree"></span></h3>
            <h4>Thème : <span id="theme"></span></h4>
            <div class="d-grid gap-2 mb-3">
              <button id="playBtn" class="btn btn-success">Jouer</button>
              <button id="stopBtn" class="btn btn-danger">Stopper</button>
            </div>
            <div id="chrono" class="mt-3 text-center" style="font-size:2em;"></div>
          </div>

          <div id="transitionContainer" class="mt-3" style="display:none;">
            <div class="d-grid gap-2 mb-3">
              <button id="stopMusicBtn" class="btn btn-secondary">Arrêter la musique</button>
            </div>
            <!-- Message d'erreur ou d'info sur la transition -->
            <div id="transitionMsg" class="alert alert-warning mt-2" style="display:none;"></div>
            <audio id="audioTransition" style="display:none;" controls></audio>
          </div>

          <div class="card mt-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>Lecteur de musiques</span>
              <a href="spotify.php" target="_blank" class="btn btn-sm btn-success">🎵 Spotify</a>
            </div>
            <div class="card-body">
              <div class="music-player-block">
                <select class="form-select mb-2" id="musicSelect"></select>
                <audio id="musicPlayer" controls style="width:100%"></audio>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Colonne droite : Lumières DMX -->
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm h-100" id="dmxCard">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>💡 Lumières (DMX)</span>
            <div class="d-flex align-items-center gap-2">
              <button id="dmxConnect" class="btn btn-sm btn-outline-primary">🔌 Connecter</button>
              <span id="dmxStatus" class="badge bg-secondary">Non connecté</span>
            </div>
          </div>
          <div class="card-body">
            <div id="dmxControls"></div>
            <div class="d-flex gap-2 mt-3">
              <button id="dmxWarm" class="btn btn-outline-secondary flex-fill py-3" style="min-height:52px;font-weight:600;" disabled>Base (blanc chaud)</button>
              <button id="dmxBlackout" class="btn btn-outline-secondary flex-fill py-3" style="min-height:52px;font-weight:600;" disabled>Noir complet</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Historiques, pleine largeur en bas -->
    <div class="row g-4 mt-1">
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Historique des catégories choisies</span>
            <button id="resetHistoryBtn" class="btn btn-sm btn-outline-danger">Reset</button>
          </div>
          <ul id="catHistoryList" class="list-group list-group-flush"></ul>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Historique des thèmes générés</span>
          </div>
          <ul id="themeHistoryList" class="list-group list-group-flush"></ul>
        </div>
      </div>
    </div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="dmx.js?v=3"></script>
<script src="main.js?v=2"></script>
</body>
</html>
