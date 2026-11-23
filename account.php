<?php
require __DIR__ . '/auth.php';
require_login_page();
$me = current_account();
$error = ''; $ok = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cur = $_POST['current'] ?? '';
    $new = $_POST['new'] ?? '';
    $new2 = $_POST['new2'] ?? '';
    if (!password_verify($cur, $me['password_hash'])) {
        $error = 'Mot de passe actuel incorrect.';
    } elseif (strlen($new) < 8) {
        $error = 'Le nouveau mot de passe doit faire au moins 8 caractères.';
    } elseif ($new !== $new2) {
        $error = 'Les deux nouveaux mots de passe ne correspondent pas.';
    } else {
        $st = db()->prepare('UPDATE accounts SET password_hash=? WHERE id=?');
        $st->bindValue(1, password_hash($new, PASSWORD_DEFAULT), SQLITE3_TEXT);
        $st->bindValue(2, $me['id'], SQLITE3_TEXT);
        $st->execute();
        $ok = true;
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — Mon compte</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
</head>
<body>
<div class="container" style="max-width:520px;margin-top:6vh;">
    <header class="app-header">
        <div class="brand"><img src="logo.svg" class="brand-logo" alt=""> Régiste</div>
        <div class="header-actions"><a href="regie.php" class="btn btn-outline-primary btn-sm">← Régie</a></div>
    </header>

    <div class="card p-4 shadow-sm">
        <h1 style="font-size:1.25rem;font-weight:700;" class="mb-1">Mon compte</h1>
        <p class="text-muted mb-3" style="font-size:.92rem;"><?= htmlspecialchars($me['company']) ?> — <?= htmlspecialchars($me['email']) ?></p>

        <h2 style="font-size:1.05rem;font-weight:700;" class="mb-3">Changer le mot de passe</h2>
        <?php if ($ok): ?><div class="alert alert-success py-2">Mot de passe mis à jour ✅</div><?php endif; ?>
        <?php if ($error): ?><div class="alert alert-danger py-2"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <form method="post">
            <div class="mb-3"><label>Mot de passe actuel</label><input type="password" name="current" class="form-control" required></div>
            <div class="mb-3"><label>Nouveau mot de passe (8+)</label><input type="password" name="new" class="form-control" required></div>
            <div class="mb-3"><label>Confirmer</label><input type="password" name="new2" class="form-control" required></div>
            <div class="d-grid"><button class="btn btn-primary">Mettre à jour</button></div>
        </form>
    </div>
</div>
</body>
</html>
