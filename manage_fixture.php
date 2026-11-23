<?php
require __DIR__ . '/auth.php';
require_login_api();
// CRUD des projecteurs (fixtures) — isolé par compte
header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$db = db();
$aid = account_id();

$ALLOWED_TYPES = ['RGB', 'RGBW', 'RGB_DIM', 'DIM_RGB', 'RGBW_DIM', 'DIM_RGBW'];

$action = $input['action'] ?? 'add';
$name = trim($input['name'] ?? '');
$address = (int)($input['address'] ?? 0);
$type = $input['type'] ?? 'RGBW';
if (!in_array($type, $ALLOWED_TYPES, true)) $type = 'RGBW';

function fail($code, $msg) { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

if ($action === 'add' || $action === 'update') {
    if ($name === '')             fail(400, 'Nom manquant');
    if ($address < 1 || $address > 512) fail(400, 'Adresse DMX invalide (1-512)');

    if ($action === 'update') {
        $id = $input['id'] ?? '';
        if (!$id) fail(400, 'ID manquant');
        $stmt = $db->prepare('UPDATE fixtures SET name=?, address=?, type=? WHERE id=? AND account_id=?');
        $stmt->bindValue(1, $name, SQLITE3_TEXT);
        $stmt->bindValue(2, $address, SQLITE3_INTEGER);
        $stmt->bindValue(3, $type, SQLITE3_TEXT);
        $stmt->bindValue(4, $id, SQLITE3_TEXT);
        $stmt->bindValue(5, $aid, SQLITE3_TEXT);
        $stmt->execute();
        echo json_encode(['id' => $id]);
        exit;
    }
    // add
    $id = uniqid();
    $pm = $db->prepare('SELECT COALESCE(MAX(position),-1)+1 FROM fixtures WHERE account_id=?');
    $pm->bindValue(1, $aid, SQLITE3_TEXT);
    $pos = (int)$pm->execute()->fetchArray(SQLITE3_NUM)[0];
    $stmt = $db->prepare('INSERT INTO fixtures (id, name, address, type, position, account_id) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $id, SQLITE3_TEXT);
    $stmt->bindValue(2, $name, SQLITE3_TEXT);
    $stmt->bindValue(3, $address, SQLITE3_INTEGER);
    $stmt->bindValue(4, $type, SQLITE3_TEXT);
    $stmt->bindValue(5, $pos, SQLITE3_INTEGER);
    $stmt->bindValue(6, $aid, SQLITE3_TEXT);
    $stmt->execute();
    echo json_encode(['id' => $id]);
    exit;
}

if ($action === 'delete') {
    $id = $input['id'] ?? '';
    if (!$id) fail(400, 'ID manquant');
    $stmt = $db->prepare('DELETE FROM fixtures WHERE id=? AND account_id=?');
    $stmt->bindValue(1, $id, SQLITE3_TEXT);
    $stmt->bindValue(2, $aid, SQLITE3_TEXT);
    $stmt->execute();
    echo json_encode(['ok' => true]);
    exit;
}

fail(400, 'Action inconnue');
