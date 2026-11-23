<?php
require __DIR__ . '/auth.php';
require_superadmin_page();
$me = current_account();

function flash($type, $msg) { $_SESSION['flash'] = ['type' => $type, 'msg' => $msg]; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check($_POST['csrf'] ?? '')) { flash('danger', 'Jeton invalide, réessaie.'); header('Location: superadmin.php'); exit; }
    $action = $_POST['action'] ?? '';
    $id = $_POST['id'] ?? '';

    if ($action === 'create') {
        $company = trim($_POST['company'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $pwd = $_POST['password'] ?? '';
        if ($company === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pwd) < 8) {
            flash('danger', 'Champs invalides (mot de passe 8 car. min).');
        } elseif (db()->querySingle("SELECT COUNT(*) FROM accounts WHERE email='" . SQLite3::escapeString($email) . "'") > 0) {
            flash('danger', 'E-mail déjà utilisé.');
        } else {
            $st = db()->prepare('INSERT INTO accounts (id,company,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)');
            $st->bindValue(1, uniqid('acc_')); $st->bindValue(2, $company); $st->bindValue(3, $email);
            $st->bindValue(4, password_hash($pwd, PASSWORD_DEFAULT)); $st->bindValue(5, 'company');
            $st->bindValue(6, 'active'); $st->bindValue(7, date('c'));
            $st->execute();
            flash('success', 'Compte créé et activé : ' . htmlspecialchars($company));
        }
    } elseif (in_array($action, ['activate', 'suspend'], true) && $id) {
        if ($id === $me['id']) { flash('danger', 'Tu ne peux pas modifier ton propre statut.'); }
        else {
            $status = $action === 'activate' ? 'active' : 'suspended';
            $target = db()->querySingle("SELECT company, email, status FROM accounts WHERE id='" . SQLite3::escapeString($id) . "'", true);
            $st = db()->prepare('UPDATE accounts SET status=? WHERE id=?');
            $st->bindValue(1, $status); $st->bindValue(2, $id); $st->execute();
            if ($action === 'activate' && $target && ($target['status'] ?? '') !== 'active') {
                notify_account_activated($target['company'], $target['email']);
                flash('success', 'Compte activé — e-mail de confirmation envoyé à ' . htmlspecialchars($target['email']) . '.');
            } else {
                flash('success', 'Statut mis à jour.');
            }
        }
    } elseif ($action === 'reset_pwd' && $id) {
        $new = bin2hex(random_bytes(5));
        $st = db()->prepare('UPDATE accounts SET password_hash=? WHERE id=?');
        $st->bindValue(1, password_hash($new, PASSWORD_DEFAULT)); $st->bindValue(2, $id); $st->execute();
        flash('success', 'Nouveau mot de passe (à transmettre) : <code>' . $new . '</code>');
    } elseif ($action === 'delete' && $id) {
        if ($id === $me['id']) { flash('danger', 'Tu ne peux pas supprimer ton propre compte.'); }
        else {
            foreach (['categories', 'musics', 'fixtures'] as $t) {
                $st = db()->prepare("DELETE FROM $t WHERE account_id=?"); $st->bindValue(1, $id); $st->execute();
            }
            $st = db()->prepare('DELETE FROM accounts WHERE id=?'); $st->bindValue(1, $id); $st->execute();
            flash('success', 'Compte et données supprimés.');
        }
    }
    header('Location: superadmin.php'); exit;
}

$accounts = [];
$res = db()->query('SELECT * FROM accounts ORDER BY status, company');
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $accounts[] = $r;
$flash = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);
$badge = ['pending' => 'bg-warning text-dark', 'active' => 'bg-success', 'suspended' => 'bg-secondary'];
$statusLabel = ['pending' => 'En attente', 'active' => 'Actif', 'suspended' => 'Suspendu'];
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Régiste — Super-admin</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="app.css?v=4" rel="stylesheet">
</head>
<body>
<div class="container-fluid py-4">
  <div style="max-width:1100px;margin:0 auto;">
    <header class="app-header">
      <div class="brand"><img src="logo.svg" class="brand-logo" alt=""> Régiste</div>
      <div class="brand-sub">Super-administration</div>
      <div class="header-actions">
        <a href="regie.php" class="btn btn-outline-primary btn-sm">← Régie</a>
        <a href="logout.php" class="btn btn-outline-primary btn-sm">Déconnexion</a>
      </div>
    </header>

    <?php if ($flash): ?><div class="alert alert-<?= $flash['type'] ?>"><?= $flash['msg'] ?></div><?php endif; ?>

    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm">
          <div class="card-header">Comptes (<?= count($accounts) ?>)</div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>Compagnie</th><th>E-mail</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                <?php foreach ($accounts as $a): ?>
                  <tr>
                    <td><strong><?= htmlspecialchars($a['company']) ?></strong>
                        <?php if ($a['role'] === 'superadmin'): ?><span class="badge bg-dark ms-1">super-admin</span><?php endif; ?></td>
                    <td><?= htmlspecialchars($a['email']) ?></td>
                    <td><span class="badge <?= $badge[$a['status']] ?? 'bg-secondary' ?>"><?= $statusLabel[$a['status']] ?? $a['status'] ?></span></td>
                    <td>
                      <?php if ($a['id'] !== $me['id']): ?>
                      <div class="d-flex flex-wrap gap-1">
                        <?php if ($a['status'] !== 'active'): ?>
                          <form method="post" class="d-inline"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="action" value="activate"><input type="hidden" name="id" value="<?= $a['id'] ?>"><button class="btn btn-sm btn-success">Activer</button></form>
                        <?php else: ?>
                          <form method="post" class="d-inline"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="action" value="suspend"><input type="hidden" name="id" value="<?= $a['id'] ?>"><button class="btn btn-sm btn-warning">Suspendre</button></form>
                        <?php endif; ?>
                        <form method="post" class="d-inline" onsubmit="return confirm('Réinitialiser le mot de passe ?');"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="action" value="reset_pwd"><input type="hidden" name="id" value="<?= $a['id'] ?>"><button class="btn btn-sm btn-outline-secondary">Reset MDP</button></form>
                        <form method="post" class="d-inline" onsubmit="return confirm('Supprimer ce compte ET toutes ses données ?');"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $a['id'] ?>"><button class="btn btn-sm btn-danger">Supprimer</button></form>
                      </div>
                      <?php else: ?><span class="text-muted" style="font-size:.85rem;">— vous —</span><?php endif; ?>
                    </td>
                  </tr>
                <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="card shadow-sm">
          <div class="card-header">Créer un compte</div>
          <div class="card-body">
            <form method="post">
              <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
              <input type="hidden" name="action" value="create">
              <div class="mb-2"><label>Compagnie</label><input name="company" class="form-control" required></div>
              <div class="mb-2"><label>E-mail</label><input type="email" name="email" class="form-control" required></div>
              <div class="mb-3"><label>Mot de passe (8+)</label><input name="password" class="form-control" required></div>
              <div class="d-grid"><button class="btn btn-primary">Créer (actif)</button></div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
