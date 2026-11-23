<?php require __DIR__."/../auth.php"; require_login_page(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — Admin</title>
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="../styles.css" rel="stylesheet">
    <link href="../app.css?v=7" rel="stylesheet">
</head>
<body>
<div class="container-fluid py-4">
  <div class="row justify-content-center">
    <div class="col-12 col-md-10 col-lg-8">
      <header class="app-header">
        <div class="brand"><img src="../logo.svg" class="brand-logo" alt=""> Régiste</div>
        <div class="brand-sub">Administration</div>
        <div class="header-actions">
          <a href="../regie.php" class="btn btn-outline-primary btn-sm">← Retour à la régie</a>
        </div>
      </header>
      <div class="card p-4 shadow-sm">
        <ul class="nav nav-tabs" id="adminTab" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="cat-tab" data-bs-toggle="tab" data-bs-target="#cat" type="button" role="tab">Catégories d'impro</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="music-tab" data-bs-toggle="tab" data-bs-target="#music" type="button" role="tab">Musiques</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="fixture-tab" data-bs-toggle="tab" data-bs-target="#fixture" type="button" role="tab">Projecteurs</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="sequence-tab" data-bs-toggle="tab" data-bs-target="#sequence" type="button" role="tab">Séquences</button>
          </li>
        </ul>
        <div class="tab-content mt-3">
          <div class="tab-pane fade show active" id="cat" role="tabpanel">
          <form id="catForm" class="mb-3">
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <label>Nom</label>
                <input type="text" class="form-control" name="name" required>
              </div>
              <div class="col-12 col-md-6">
                <label>Type</label>
                <select class="form-select" name="type" required>
                  <option value="Univers">Univers</option>
                  <option value="Litteraire">Littéraire</option>
                  <option value="Technique">Technique</option>
                  <option value="Punch">Punch</option>
                  <option value="Libre">Libre</option>
                </select>
              </div>
              <div class="col-12">
                <label>Description</label>
                <textarea class="form-control" name="description" required></textarea>
              </div>
              <div class="col-12">
                <label>Durées possibles (en secondes, séparées par des virgules)</label>
                <input type="text" class="form-control" name="durees" placeholder="120,60,80" required>
              </div>
              <div class="col-12">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="theme_generated" id="themeGeneratedCheck" checked>
                  <label class="form-check-label" for="themeGeneratedCheck">Thème généré automatiquement</label>
                </div>
              </div>
              <div class="col-12 text-end">
                <button type="submit" class="btn btn-primary" id="catSubmitBtn">Ajouter catégorie</button>
                <button type="button" class="btn btn-secondary ms-2" id="catCancelBtn" style="display:none;">Annuler</button>
              </div>
            </div>
          </form>
          
          <div class="table-responsive">
            <table class="table table-striped" id="catTable">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Durées</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="catList">
              </tbody>
            </table>
          </div>
        </div>
          <div class="tab-pane fade" id="music" role="tabpanel">
            <!-- Formulaire d'ajout musique -->
            <form id="musicForm" class="mb-3" enctype="multipart/form-data">
            <div class="row g-2">
              <div class="col-12 col-md-7">
                <label>Fichier MP3</label>
                <input type="file" class="form-control" name="mp3file" accept="audio/mp3,audio/mpeg" required>
                <input type="text" class="form-control mt-2" name="title" placeholder="Titre (optionnel)">
              </div>
              <div class="col-12 col-md-3 d-flex align-items-center">
                <div class="form-check mt-3 mt-md-0 mb-2">
                  <input class="form-check-input" type="checkbox" name="transition" id="transitionCheck">
                  <label class="form-check-label" for="transitionCheck">Utilisable en transition</label>
                </div>
              </div>
              <div class="col-12 mt-2">
                <label class="form-label mb-1">Types associés :</label><br>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Univers" id="typeUnivers">
                  <label class="form-check-label" for="typeUnivers">Univers</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Litteraire" id="typeLitteraire">
                  <label class="form-check-label" for="typeLitteraire">Littéraire</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Technique" id="typeTechnique">
                  <label class="form-check-label" for="typeTechnique">Technique</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Punch" id="typePunch">
                  <label class="form-check-label" for="typePunch">Punch</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Libre" id="typeLibre">
                  <label class="form-check-label" for="typeLibre">Libre</label>
                </div>
              </div>
              <div class="col-12 col-md-2 d-grid">
                <label class="invisible">Valider</label>
                <button type="submit" class="btn btn-primary" id="musicSubmitBtn">Ajouter musique</button>
              </div>
            </div>
          </form>

          <!-- Formulaire d'édition musique (affiché uniquement en mode édition) -->
          <form id="musicEditForm" class="mb-3" style="display:none;">
            <div class="row g-2">
              <div class="col-12 col-md-7">
                <label>Titre</label>
                <input type="text" class="form-control" name="title" required>
              </div>
              <div class="col-12 col-md-3 d-flex align-items-center">
                <div class="form-check mt-3 mt-md-0 mb-2">
                  <input class="form-check-input" type="checkbox" name="transition" id="editTransitionCheck">
                  <label class="form-check-label" for="editTransitionCheck">Utilisable en transition</label>
                </div>
              </div>
              <div class="col-12 mt-2">
                <label class="form-label mb-1">Types associés :</label><br>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Univers" id="editTypeUnivers">
                  <label class="form-check-label" for="editTypeUnivers">Univers</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Litteraire" id="editTypeLitteraire">
                  <label class="form-check-label" for="editTypeLitteraire">Littéraire</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Technique" id="editTypeTechnique">
                  <label class="form-check-label" for="editTypeTechnique">Technique</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Punch" id="editTypePunch">
                  <label class="form-check-label" for="editTypePunch">Punch</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" name="types[]" value="Libre" id="editTypeLibre">
                  <label class="form-check-label" for="editTypeLibre">Libre</label>
                </div>
              </div>
              <div class="col-12 col-md-2 d-grid">
                <label class="invisible">Valider</label>
                <button type="submit" class="btn btn-success" id="musicEditSubmitBtn">Enregistrer</button>
                <button type="button" class="btn btn-secondary mt-2" id="musicEditCancelBtn">Annuler</button>
              </div>
            </div>
          </form>
            <div id="musicList"></div>
          </div>
          <div class="tab-pane fade" id="fixture" role="tabpanel">
            <form id="fixtureForm" class="mb-3">
              <input type="hidden" name="id">
              <div class="row g-2 align-items-end">
                <div class="col-12 col-md-4">
                  <label>Nom du projecteur</label>
                  <input type="text" class="form-control" name="name" placeholder="Par jardin" required>
                </div>
                <div class="col-6 col-md-2">
                  <label>Adresse DMX</label>
                  <input type="number" class="form-control" name="address" min="1" max="512" placeholder="1" required>
                </div>
                <div class="col-6 col-md-4">
                  <label>Type</label>
                  <select class="form-select" name="type">
                    <option value="RGBW">RGBW (R, G, B, W)</option>
                    <option value="RGB">RGB (R, G, B)</option>
                    <option value="RGB_DIM">RGB + Dimmer (R, G, B, Dim)</option>
                    <option value="DIM_RGB">Dimmer + RGB (Dim, R, G, B)</option>
                    <option value="RGBW_DIM">RGBW + Dimmer (R, G, B, W, Dim)</option>
                    <option value="DIM_RGBW">Dimmer + RGBW (Dim, R, G, B, W)</option>
                  </select>
                </div>
                <div class="col-12 col-md-2 d-grid">
                  <button type="submit" class="btn btn-primary" id="fixtureSubmitBtn">Ajouter</button>
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm mt-2" id="fixtureCancelBtn" style="display:none;">Annuler l'édition</button>
            </form>
            <div class="table-responsive">
              <table class="table table-striped">
                <thead>
                  <tr><th>Nom</th><th>Adresse DMX</th><th>Type</th><th>Canaux</th><th>Actions</th></tr>
                </thead>
                <tbody id="fixtureList"></tbody>
              </table>
            </div>
            <small class="text-muted">L'« adresse DMX » est le 1er canal du projecteur. Le « type » décrit l'ordre de ses canaux. Les changements sont pris en compte sur la page principale après rechargement.</small>
          </div>
          <div class="tab-pane fade" id="sequence" role="tabpanel">
            <div id="seqListView">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <p class="text-muted mb-0" style="font-size:.9rem;">Enchaîne lumière, son et chrono. Les 9 premières se lancent avec les touches <kbd>1</kbd>…<kbd>9</kbd> dans la régie.</p>
                <button type="button" class="btn btn-primary btn-sm flex-shrink-0" id="seqNewBtn">+ Nouvelle séquence</button>
              </div>
              <div class="table-responsive">
                <table class="table align-middle">
                  <thead><tr><th style="width:90px;">Ordre</th><th>Nom</th><th>Déclenchement</th><th>Étapes</th><th>Actions</th></tr></thead>
                  <tbody id="seqAdminList"></tbody>
                </table>
              </div>
            </div>

            <form id="seqEditor" style="display:none;">
              <div class="row g-2 align-items-end mb-3">
                <div class="col-12 col-md-5">
                  <label for="seqName">Nom</label>
                  <input type="text" class="form-control" id="seqName" maxlength="60" placeholder="Ouverture du spectacle" required>
                </div>
                <div class="col-7 col-md-4">
                  <label for="seqTrigger">Déclenchement</label>
                  <select class="form-select" id="seqTrigger">
                    <option value="">Manuel (bouton / touche)</option>
                    <option value="start">Automatique au « Jouer »</option>
                    <option value="stop">Automatique au « Stopper » (remplace noir 3 s → blanc chaud)</option>
                  </select>
                </div>
                <div class="col-5 col-md-3">
                  <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="seqLoop">
                    <label class="form-check-label" for="seqLoop">🔁 En boucle</label>
                  </div>
                </div>
              </div>

              <label>Étapes</label>
              <ol id="seqSteps" class="seq-steps"></ol>
              <div class="d-flex gap-2 mt-2">
                <select class="form-select" id="seqAddStep" style="max-width:280px;" aria-label="Ajouter une étape">
                  <option value="">+ Ajouter une étape…</option>
                </select>
              </div>

              <div class="d-flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary">Enregistrer</button>
                <button type="button" class="btn btn-secondary" id="seqCancelBtn">Annuler</button>
              </div>
              <small class="text-muted d-block mt-2">Un fondu « en parallèle » démarre et passe tout de suite à l'étape suivante (pour fondre plusieurs projecteurs ensemble). Les lumières ne bougent que si le DMX est connecté dans la régie.</small>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="admin.js?v=3"></script>
<script src="../sequences.js?v=1"></script>
<script src="sequences-admin.js?v=1"></script>
</body>
</html>
