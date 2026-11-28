<?php
require __DIR__ . '/auth.php';
require_login_api();
// Disposition du dock Mirabox (touche → action), une par compte.
// GET : renvoie la disposition enregistrée (ou null). POST JSON : l'enregistre.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$db = db();
$db->exec('CREATE TABLE IF NOT EXISTS dock_layouts (
    account_id TEXT PRIMARY KEY,
    layout TEXT NOT NULL,
    updated_at TEXT
)');
$aid = account_id();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $st = $db->prepare('SELECT layout FROM dock_layouts WHERE account_id = ?');
    $st->bindValue(1, $aid, SQLITE3_TEXT);
    $row = $st->execute()->fetchArray(SQLITE3_ASSOC);
    echo $row ? $row['layout'] : 'null';
    exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) { http_response_code(400); echo json_encode(['error' => 'JSON invalide']); exit; }

// Ne garde que des champs connus et bornés
$keys = [];
foreach ((array)($in['keys'] ?? []) as $pos => $action) {
    if (!preg_match('/^[0-2],[0-5]$/', (string)$pos)) continue;
    if (!is_string($action) || !preg_match('/^[A-Za-z0-9:_.\-#%@ ]{0,300}$/u', $action)) continue;
    if ($action !== '') $keys[$pos] = $action;
}
$layout = [
    'version'    => 1,
    'brightness' => max(0, min(100, (int)($in['brightness'] ?? 70))),
    'rotation'   => in_array((int)($in['rotation'] ?? 270), [0, 90, 180, 270], true) ? (int)$in['rotation'] : 270,
    'keys'       => (object)$keys,
];
$json = json_encode($layout, JSON_UNESCAPED_UNICODE);

$st = $db->prepare('INSERT INTO dock_layouts (account_id, layout, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET layout = excluded.layout, updated_at = excluded.updated_at');
$st->bindValue(1, $aid, SQLITE3_TEXT);
$st->bindValue(2, $json, SQLITE3_TEXT);
$st->bindValue(3, date('c'), SQLITE3_TEXT);
$st->execute();
echo $json;
