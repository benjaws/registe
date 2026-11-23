<?php
// Socle d'authentification & sessions (multi-comptes)
if (session_status() === PHP_SESSION_NONE) {
    session_name('REGISTE');
    session_set_cookie_params(['lifetime' => 0, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function db() {
    static $db = null;
    if (!$db) {
        $db = new SQLite3(__DIR__ . '/data/impro.sqlite');
        $db->busyTimeout(4000);
    }
    return $db;
}

function current_account() {
    if (empty($_SESSION['account_id'])) return null;
    $st = db()->prepare('SELECT * FROM accounts WHERE id = ?');
    $st->bindValue(1, $_SESSION['account_id'], SQLITE3_TEXT);
    $row = $st->execute()->fetchArray(SQLITE3_ASSOC);
    if (!$row || $row['status'] !== 'active') return null;
    return $row;
}

function account_id() { $a = current_account(); return $a ? $a['id'] : null; }
function is_superadmin() { $a = current_account(); return $a && $a['role'] === 'superadmin'; }

function login_account($email, $password) {
    $st = db()->prepare('SELECT * FROM accounts WHERE email = ?');
    $st->bindValue(1, strtolower(trim($email)), SQLITE3_TEXT);
    $row = $st->execute()->fetchArray(SQLITE3_ASSOC);
    if (!$row) return ['ok' => false, 'error' => 'Identifiants incorrects.'];
    if (!password_verify($password, $row['password_hash'])) return ['ok' => false, 'error' => 'Identifiants incorrects.'];
    if ($row['status'] === 'pending') return ['ok' => false, 'error' => "Compte en attente de validation par l'administrateur."];
    if ($row['status'] === 'suspended') return ['ok' => false, 'error' => 'Compte suspendu.'];
    session_regenerate_id(true);
    $_SESSION['account_id'] = $row['id'];
    return ['ok' => true, 'account' => $row];
}

function logout_account() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// --- Garde pour les pages (redirige) ---
function require_login_page() {
    if (!current_account()) { header('Location: login.php'); exit; }
}
function require_superadmin_page() {
    $a = current_account();
    if (!$a) { header('Location: login.php'); exit; }
    if ($a['role'] !== 'superadmin') { http_response_code(403); echo 'Accès refusé.'; exit; }
}

// --- Garde pour les endpoints JSON (401) ---
function require_login_api() {
    if (!current_account()) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Non authentifié']);
        exit;
    }
}

// Jeton CSRF simple
function csrf_token() {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function csrf_check($t) { return !empty($t) && hash_equals($_SESSION['csrf'] ?? '', $t); }

// --- E-mails -------------------------------------------------------------
// Config facultative : créez data/mail_config.php qui renvoie un tableau
//   return ['from' => 'Régiste <no-reply@mon-domaine.ch>', 'admin' => 'moi@domaine.ch'];
// Sinon : expéditeur = no-reply@<hôte>, destinataire d'alerte = les super-admins actifs.
function mail_config() {
    static $cfg = null;
    if ($cfg === null) {
        $f = __DIR__ . '/data/mail_config.php';
        $cfg = (is_file($f) ? require $f : []) ?: [];
    }
    return $cfg;
}

function mail_host() {
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return preg_replace('/:\d+$/', '', $host);
}

function base_url() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? mail_host();
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $scheme . '://' . $host . $dir . '/';
}

function send_mail($to, $subject, $body) {
    if (!$to) return false;
    $from = mail_config()['from'] ?? ('Régiste <no-reply@' . mail_host() . '>');
    $headers = [
        'From: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    $subjectEnc = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    return @mail($to, $subjectEnc, $body, implode("\r\n", $headers));
}

// E-mails des super-admins actifs (destinataires des alertes d'inscription)
function superadmin_emails() {
    $cfg = mail_config();
    if (!empty($cfg['admin'])) return array_map('trim', explode(',', $cfg['admin']));
    $out = [];
    $res = db()->query("SELECT email FROM accounts WHERE role = 'superadmin' AND status = 'active'");
    while ($r = $res->fetchArray(SQLITE3_ASSOC)) $out[] = $r['email'];
    return $out;
}

// Appelé après une inscription : alerte les admins + accuse réception à la compagnie.
function notify_new_signup($company, $email) {
    $url = base_url() . 'superadmin.php';
    $when = date('d/m/Y à H:i');

    foreach (superadmin_emails() as $admin) {
        send_mail(
            $admin,
            "Régiste — nouvelle demande de compte : $company",
            "Une nouvelle compagnie vient de demander un compte sur Régiste.\n\n"
            . "Compagnie : $company\n"
            . "E-mail    : $email\n"
            . "Date      : $when\n\n"
            . "Pour l'activer, rends-toi dans l'interface super-admin :\n$url\n"
        );
    }

    send_mail(
        $email,
        'Régiste — ta demande de compte est bien reçue',
        "Bonjour,\n\n"
        . "Nous avons bien reçu ta demande de compte pour « $company ».\n"
        . "Un administrateur va la valider rapidement : tu recevras un e-mail dès que ton compte sera activé.\n\n"
        . "À très vite,\nL'équipe Régiste\n"
    );
}

// Appelé quand un compte passe à « actif ».
function notify_account_activated($company, $email) {
    send_mail(
        $email,
        'Régiste — ton compte est activé 🎉',
        "Bonjour,\n\n"
        . "Bonne nouvelle : le compte « $company » est maintenant actif.\n"
        . "Tu peux te connecter dès maintenant :\n" . base_url() . "login.php\n\n"
        . "Bon spectacle !\nL'équipe Régiste\n"
    );
}
