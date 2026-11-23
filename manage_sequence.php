<?php
require __DIR__ . '/auth.php';
require __DIR__ . '/sequences_db.php';
require_login_api();
// CRUD des séquences personnalisées — isolé par compte
header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$db = db();
$aid = account_id();
ensure_sequences_table();

function fail($code, $msg) { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

$action = $input['action'] ?? 'save';

if ($action === 'save') {
    $name = seq_str($input['name'] ?? '', 60);
    if ($name === '') fail(400, 'Nom manquant');
    $trigger = in_array($input['trigger'] ?? '', SEQ_TRIGGERS, true) ? $input['trigger'] : '';
    $loop = !empty($input['loop']) ? 1 : 0;
    $steps = sanitize_steps($input['steps'] ?? []);
    if (!$steps) fail(400, 'Ajoute au moins une étape');
    if ($loop && !array_filter($steps, fn($s) => in_array($s['type'], ['wait', 'go'], true)
            || (($s['fade'] ?? 0) > 0))) {
        fail(400, 'Une séquence en boucle doit contenir au moins une attente ou un fondu');
    }
    // Un seul déclencheur « Jouer » et un seul « Stopper » par compte
    if ($trigger !== '') {
        $st = $db->prepare('UPDATE sequences SET trigger_on=\'\' WHERE account_id=? AND trigger_on=? AND id<>?');
        $st->bindValue(1, $aid, SQLITE3_TEXT);
        $st->bindValue(2, $trigger, SQLITE3_TEXT);
        $st->bindValue(3, $input['id'] ?? '', SQLITE3_TEXT);
        $st->execute();
    }
    $json = json_encode($steps, JSON_UNESCAPED_UNICODE);
    $id = $input['id'] ?? '';
    if ($id) {
        $st = $db->prepare('UPDATE sequences SET name=?, trigger_on=?, is_loop=?, steps=? WHERE id=? AND account_id=?');
        $st->bindValue(1, $name, SQLITE3_TEXT);
        $st->bindValue(2, $trigger, SQLITE3_TEXT);
        $st->bindValue(3, $loop, SQLITE3_INTEGER);
        $st->bindValue(4, $json, SQLITE3_TEXT);
        $st->bindValue(5, $id, SQLITE3_TEXT);
        $st->bindValue(6, $aid, SQLITE3_TEXT);
        $st->execute();
        if ($db->changes() === 0) {
            // rien modifié : soit identique, soit pas à ce compte
            $chk = $db->prepare('SELECT 1 FROM sequences WHERE id=? AND account_id=?');
            $chk->bindValue(1, $id, SQLITE3_TEXT);
            $chk->bindValue(2, $aid, SQLITE3_TEXT);
            if (!$chk->execute()->fetchArray()) fail(404, 'Séquence introuvable');
        }
        echo json_encode(['id' => $id]);
        exit;
    }
    $id = uniqid();
    $pm = $db->prepare('SELECT COALESCE(MAX(position),-1)+1 FROM sequences WHERE account_id=?');
    $pm->bindValue(1, $aid, SQLITE3_TEXT);
    $pos = (int)$pm->execute()->fetchArray(SQLITE3_NUM)[0];
    $st = $db->prepare('INSERT INTO sequences (id, name, trigger_on, is_loop, steps, position, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $st->bindValue(1, $id, SQLITE3_TEXT);
    $st->bindValue(2, $name, SQLITE3_TEXT);
    $st->bindValue(3, $trigger, SQLITE3_TEXT);
    $st->bindValue(4, $loop, SQLITE3_INTEGER);
    $st->bindValue(5, $json, SQLITE3_TEXT);
    $st->bindValue(6, $pos, SQLITE3_INTEGER);
    $st->bindValue(7, $aid, SQLITE3_TEXT);
    $st->execute();
    echo json_encode(['id' => $id]);
    exit;
}

if ($action === 'delete') {
    $id = $input['id'] ?? '';
    if (!$id) fail(400, 'ID manquant');
    $st = $db->prepare('DELETE FROM sequences WHERE id=? AND account_id=?');
    $st->bindValue(1, $id, SQLITE3_TEXT);
    $st->bindValue(2, $aid, SQLITE3_TEXT);
    $st->execute();
    echo json_encode(['ok' => true]);
    exit;
}

// Nouvel ordre : liste d'ids
if ($action === 'reorder') {
    $ids = $input['ids'] ?? [];
    if (!is_array($ids)) fail(400, 'Liste invalide');
    $st = $db->prepare('UPDATE sequences SET position=? WHERE id=? AND account_id=?');
    foreach (array_values($ids) as $i => $id) {
        $st->reset();
        $st->bindValue(1, $i, SQLITE3_INTEGER);
        $st->bindValue(2, (string)$id, SQLITE3_TEXT);
        $st->bindValue(3, $aid, SQLITE3_TEXT);
        $st->execute();
    }
    echo json_encode(['ok' => true]);
    exit;
}

fail(400, 'Action inconnue');
