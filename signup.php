<?php
require __DIR__ . '/auth.php';
if (current_account()) { header('Location: regie.php'); exit; }

$error = ''; $done = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $company = trim($_POST['company'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $pwd = $_POST['password'] ?? '';
    $pwd2 = $_POST['password2'] ?? '';

    if ($company === '' || $email === '' || $pwd === '') {
        $error = 'Merci de remplir tous les champs.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'E-mail invalide.';
    } elseif (strlen($pwd) < 8) {
        $error = 'Le mot de passe doit faire au moins 8 caractères.';
    } elseif ($pwd !== $pwd2) {
        $error = 'Les deux mots de passe ne correspondent pas.';
    } else {
        $exists = db()->querySingle("SELECT COUNT(*) FROM accounts WHERE email = '" . SQLite3::escapeString($email) . "'");
        if ($exists > 0) {
            $error = 'Un compte existe déjà avec cet e-mail.';
        } else {
            $st = db()->prepare('INSERT INTO accounts (id, company, email, password_hash, role, status, created_at) VALUES (?,?,?,?,?,?,?)');
            $st->bindValue(1, uniqid('acc_'), SQLITE3_TEXT);
            $st->bindValue(2, $company, SQLITE3_TEXT);
            $st->bindValue(3, $email, SQLITE3_TEXT);
            $st->bindValue(4, password_hash($pwd, PASSWORD_DEFAULT), SQLITE3_TEXT);
            $st->bindValue(5, 'company', SQLITE3_TEXT);
            $st->bindValue(6, 'pending', SQLITE3_TEXT);
            $st->bindValue(7, date('c'), SQLITE3_TEXT);
            $st->execute();
            notify_new_signup($company, $email);
            $done = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — Créer un compte</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
</head>
<body>
<div class="container" style="max-width:460px;margin-top:7vh;">
    <div class="text-center mb-4">
        <a href="index.php" style="text-decoration:none;" class="brand">
            <img src="logo.svg" class="brand-logo" style="margin:0 auto 10px;" alt=""><br>Régiste
        </a>
    </div>
    <div class="card p-4 shadow-sm">
        <?php if ($done): ?>
            <h1 style="font-size:1.3rem;font-weight:700;" class="mb-3 text-center">Compte créé ✅</h1>
            <p class="text-center">Ta demande est enregistrée. Un administrateur doit <strong>valider ton compte</strong> avant que tu puisses te connecter. Tu seras prévenu·e une fois activé.</p>
            <div class="d-grid mt-2"><a href="login.php" class="btn btn-primary">Retour à la connexion</a></div>
        <?php else: ?>
            <h1 style="font-size:1.3rem;font-weight:700;" class="mb-3 text-center">Créer un compte compagnie</h1>
            <?php if ($error): ?><div class="alert alert-danger py-2"><?= htmlspecialchars($error) ?></div><?php endif; ?>
            <form method="post">
                <div class="mb-3">
                    <label>Nom de la compagnie</label>
                    <input type="text" name="company" class="form-control" required value="<?= htmlspecialchars($_POST['company'] ?? '') ?>">
                </div>
                <div class="mb-3">
                    <label>E-mail</label>
                    <input type="email" name="email" class="form-control" required value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
                </div>
                <div class="mb-3">
                    <label>Mot de passe (8 caractères min.)</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label>Confirmer le mot de passe</label>
                    <input type="password" name="password2" class="form-control" required>
                </div>
                <div class="d-grid"><button class="btn btn-primary btn-lg">Créer mon compte</button></div>
            </form>
            <p class="text-center mt-3 mb-0" style="font-size:.92rem;">Déjà un compte ? <a href="login.php">Se connecter</a></p>
        <?php endif; ?>
    </div>
    <p class="text-center mt-3"><a href="index.php" style="color:var(--muted);font-size:.9rem;">← Retour à l'accueil</a></p>
</div>
</body>
</html>
