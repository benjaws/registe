<?php
require __DIR__ . '/auth.php';
if (current_account()) { header('Location: regie.php'); exit; }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $r = login_account($_POST['email'] ?? '', $_POST['password'] ?? '');
    if ($r['ok']) { header('Location: regie.php'); exit; }
    $error = $r['error'];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — Connexion</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
</head>
<body>
<div class="container" style="max-width:440px;margin-top:8vh;">
    <div class="text-center mb-4">
        <a href="index.php" style="text-decoration:none;" class="brand" >
            <img src="logo.svg" class="brand-logo" style="margin:0 auto 10px;" alt=""><br>Régiste
        </a>
    </div>
    <div class="card p-4 shadow-sm">
        <h1 style="font-size:1.3rem;font-weight:700;" class="mb-3 text-center">Connexion à la régie</h1>
        <?php if ($error): ?><div class="alert alert-danger py-2"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <form method="post">
            <div class="mb-3">
                <label>E-mail</label>
                <input type="email" name="email" class="form-control" required autofocus value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
            </div>
            <div class="mb-3">
                <label>Mot de passe</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <div class="d-grid">
                <button class="btn btn-primary btn-lg">Se connecter</button>
            </div>
        </form>
        <p class="text-center mt-3 mb-0" style="font-size:.92rem;">
            Pas encore de compte ? <a href="signup.php">Créer un compte</a>
        </p>
    </div>
    <p class="text-center mt-3"><a href="index.php" style="color:var(--muted);font-size:.9rem;">← Retour à l'accueil</a></p>
</div>
</body>
</html>
