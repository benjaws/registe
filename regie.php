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
    <link href="app.css?v=7" rel="stylesheet">
</head>
<body>
<div class="container-fluid py-4">
  <div style="max-width:1400px;margin:0 auto;">
    <header class="app-header">
      <div class="brand"><img src="logo.svg" class="brand-logo" alt=""> Régiste</div>
      <div class="brand-sub">Régie de spectacle d'impro</div>
      <div class="header-actions">
        <a href="chrono.php" target="_blank" class="btn btn-outline-primary btn-sm">⏱️ Chrono (écran)</a>
        <button type="button" id="keysHelpBtn" class="btn btn-outline-primary btn-sm" title="Raccourcis clavier (?)">⌨️ Raccourcis</button>
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
            <label for="catSelect">Catégorie</label>
            <div class="d-flex gap-2">
              <select class="form-select" name="cat" id="catSelect" required></select>
              <button type="submit" class="btn btn-primary flex-shrink-0" title="Raccourci : V">Valider</button>
            </div>
          </form>
          <div id="result" class="mt-3" style="display:none;">
            <h3>Durée : <span id="duree"></span></h3>
            <h4>Thème : <span id="theme"></span></h4>
            <div class="d-grid gap-2 mb-3">
              <button id="playBtn" class="btn btn-success" title="Raccourci : J">Jouer</button>
              <button id="stopBtn" class="btn btn-danger" title="Raccourci : S">Stopper</button>
            </div>
            <div id="chrono" class="mt-3 text-center" style="font-size:2em;"></div>
          </div>

          <div id="transitionContainer" class="mt-3" style="display:none;">
            <div class="d-grid gap-2 mb-3">
              <button id="stopMusicBtn" class="btn btn-secondary" title="Raccourci : M">Arrêter la musique</button>
            </div>
            <!-- Message d'erreur ou d'info sur la transition -->
            <div id="transitionMsg" class="alert alert-warning mt-2" style="display:none;"></div>
            <audio id="audioTransition" style="display:none;" controls></audio>
          </div>

          <div class="card mt-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>Musique</span>
              <div class="music-tabs" role="tablist" title="Raccourci : T">
                <button type="button" data-music-tab="local" class="active">Local</button>
                <button type="button" data-music-tab="spotify">Spotify</button>
              </div>
            </div>
            <div class="card-body">
              <div class="music-player-block" id="musicLocalPane">
                <select class="form-select mb-2" id="musicSelect"></select>
                <audio id="musicPlayer" controls style="width:100%"></audio>
              </div>

              <div id="spMini" style="display:none;">
                <div id="spOff" class="sp-off" style="display:none;">
                  <p>Connecte ton compte Spotify (Premium) pour chercher et lancer des titres d'ici.</p>
                  <button type="button" id="spConnect" class="btn btn-success btn-sm">Se connecter à Spotify</button>
                  <div><a href="spotify.php" class="sp-small">Configuration</a></div>
                </div>

                <div id="spOn" style="display:none;">
                  <select class="form-select form-select-sm mb-2" id="spPlaylist"><option>Chargement…</option></select>
                  <input type="search" class="form-control form-control-sm mb-2" id="spSearch" placeholder="Rechercher un titre, un artiste…" autocomplete="off">
                  <div id="spList" class="sp-list"><div class="sp-empty">Choisis une playlist ou lance une recherche.</div></div>

                  <div id="spMsg" class="sp-msg" style="display:none;"></div>

                  <div class="sp-player">
                    <div class="sp-now">
                      <img id="spCover" alt="" style="visibility:hidden;">
                      <div class="sp-meta"><span class="sp-t" id="spTitle">—</span><span class="sp-a" id="spArtist"></span></div>
                      <div class="sp-btns">
                        <button type="button" id="spPrev" title="Précédent">⏮</button>
                        <button type="button" id="spPlay" class="sp-play" title="Lecture / pause">▶</button>
                        <button type="button" id="spNext" title="Suivant">⏭</button>
                      </div>
                    </div>
                    <div class="sp-seek">
                      <span id="spCur">0:00</span>
                      <input type="range" id="spSeek" min="0" max="1000" value="0" aria-label="Position">
                      <span id="spDur">0:00</span>
                    </div>
                    <div class="sp-foot">
                      <span class="sp-vol">🔉 <input type="range" id="spVol" min="0" max="100" value="80" aria-label="Volume"></span>
                      <span class="sp-small"><span id="spMe"></span> · <a href="#" id="spLogout">Déconnexion</a></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Colonne droite : Lumières DMX -->
      <div class="col-12 col-lg-8 d-flex flex-column gap-4">
        <div class="card shadow-sm flex-grow-1" id="dmxCard">
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
              <button id="dmxWarm" title="Raccourci : B" class="btn btn-outline-secondary flex-fill py-3" style="min-height:52px;font-weight:600;" disabled>Base (blanc chaud)</button>
              <button id="dmxBlackout" title="Raccourci : N" class="btn btn-outline-secondary flex-fill py-3" style="min-height:52px;font-weight:600;" disabled>Noir complet</button>
            </div>
          </div>
        </div>

        <!-- Séquences personnalisées -->
        <div class="card shadow-sm" id="seqPanel">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>🎬 Séquences</span>
            <a href="admin/#sequences" class="btn btn-sm btn-outline-primary">✏️ Modifier</a>
          </div>
          <div class="card-body">
            <div id="seqList" class="seq-list"><div class="seq-empty">Chargement…</div></div>
            <div id="seqStatus" class="seq-status" style="display:none;">
              <div class="seq-progress"><div id="seqBar"></div></div>
              <div class="d-flex align-items-center gap-2 mt-2">
                <div id="seqNow" class="seq-now flex-grow-1"></div>
                <button type="button" id="seqGo" class="btn btn-sm btn-primary" title="Raccourci : G" disabled>GO</button>
                <button type="button" id="seqStop" class="btn btn-sm btn-outline-secondary" title="Raccourci : Échap">⏹ Arrêter</button>
              </div>
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
<!-- Aide : raccourcis clavier -->
<div class="modal fade" id="keysModal" tabindex="-1" aria-labelledby="keysModalTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content keys-help">
      <div class="modal-header">
        <h5 class="modal-title" id="keysModalTitle">⌨️ Raccourcis clavier</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
      </div>
      <div class="modal-body">
        <h6>Impro</h6>
        <dl>
          <dt><kbd>V</kbd></dt><dd>Valider la catégorie (tirage durée + thème)</dd>
          <dt><kbd>J</kbd></dt><dd>Jouer (lance le chrono)</dd>
          <dt><kbd>S</kbd></dt><dd>Stopper (fin d'impro + musique de transition)</dd>
        </dl>
        <h6>Musique</h6>
        <dl>
          <dt><kbd>Espace</kbd></dt><dd>Lecture / pause (onglet affiché)</dd>
          <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Titre précédent / suivant (Spotify) · −10 s / +10 s (local)</dd>
          <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Volume + / −</dd>
          <dt><kbd>M</kbd></dt><dd>Fondu : arrêter la musique de transition</dd>
          <dt><kbd>T</kbd></dt><dd>Basculer Local ↔ Spotify</dd>
          <dt><kbd>/</kbd></dt><dd>Rechercher sur Spotify (<kbd>Échap</kbd> pour sortir du champ)</dd>
        </dl>
        <h6>Lumières</h6>
        <dl>
          <dt><kbd>B</kbd></dt><dd>Base (blanc chaud)</dd>
          <dt><kbd>N</kbd></dt><dd>Noir complet / rallumer</dd>
        </dl>
        <h6>Séquences</h6>
        <dl>
          <dt><kbd>1</kbd> … <kbd>9</kbd></dt><dd>Lancer la séquence n°1 à 9</dd>
          <dt><kbd>G</kbd></dt><dd>GO (étape « Attendre GO »)</dd>
          <dt><kbd>Échap</kbd></dt><dd>Arrêter la séquence en cours</dd>
        </dl>
        <h6>Aide</h6>
        <dl>
          <dt><kbd>?</kbd></dt><dd>Afficher / masquer cette aide</dd>
        </dl>
        <p class="keys-note">Les raccourcis sont inactifs pendant la saisie dans un champ.</p>
      </div>
    </div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="dmx.js?v=4"></script>
<script src="main.js?v=4"></script>
<script src="spotify.js?v=4"></script>
<script src="sequences.js?v=1"></script>
<script src="keys.js?v=2"></script>
</body>
</html>
