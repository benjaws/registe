<?php
require __DIR__ . '/auth.php';
require_login_api();
// Gestion des catégories (édition, suppression, activation) — isolé par compte
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$db = db();
$aid = account_id();

$action = $input['action'] ?? '';
$id = $input['id'] ?? '';

if ($action === 'update') {
    if (!$id) { http_response_code(400); echo json_encode(["error" => "ID manquant"]); exit; }
    $themeGenerated = array_key_exists('theme_generated', $input) ? ($input['theme_generated'] ? 1 : 0) : 1;
    $stmt = $db->prepare('UPDATE categories SET name=?, type=?, description=?, durees=?, theme_generated=? WHERE id=? AND account_id=?');
    $stmt->bindValue(1, $input['name'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(2, $input['type'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(3, $input['description'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(4, json_encode($input['durees'] ?? [], JSON_UNESCAPED_UNICODE), SQLITE3_TEXT);
    $stmt->bindValue(5, $themeGenerated, SQLITE3_INTEGER);
    $stmt->bindValue(6, $id, SQLITE3_TEXT);
    $stmt->bindValue(7, $aid, SQLITE3_TEXT);
    $stmt->execute();
    http_response_code(200); exit;
}
if ($action === 'delete') {
    $stmt = $db->prepare('DELETE FROM categories WHERE id=? AND account_id=?');
    $stmt->bindValue(1, $id, SQLITE3_TEXT); $stmt->bindValue(2, $aid, SQLITE3_TEXT); $stmt->execute();
    http_response_code(200); exit;
}
if ($action === 'toggle_active') {
    $cur = $db->prepare('SELECT active FROM categories WHERE id=? AND account_id=?');
    $cur->bindValue(1, $id, SQLITE3_TEXT); $cur->bindValue(2, $aid, SQLITE3_TEXT);
    $row = $cur->execute()->fetchArray(SQLITE3_NUM);
    if ($row !== false) {
        $new = $row[0] ? 0 : 1;
        $up = $db->prepare('UPDATE categories SET active=? WHERE id=? AND account_id=?');
        $up->bindValue(1, $new, SQLITE3_INTEGER); $up->bindValue(2, $id, SQLITE3_TEXT); $up->bindValue(3, $aid, SQLITE3_TEXT);
        $up->execute();
    }
    http_response_code(200); exit;
}
http_response_code(400);
echo json_encode(["error" => "Action inconnue"]);
