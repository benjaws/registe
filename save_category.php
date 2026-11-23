<?php
require __DIR__ . '/auth.php';
require_login_api();
header('Content-Type: application/json');
// Enregistre une catégorie pour le compte connecté
$input = json_decode(file_get_contents('php://input'), true);
$db = db();

$id = uniqid();
$name = $input['name'] ?? '';
$type = $input['type'] ?? '';
$description = $input['description'] ?? '';
$durees = json_encode($input['durees'] ?? [], JSON_UNESCAPED_UNICODE);
$themeGenerated = array_key_exists('theme_generated', $input) ? ($input['theme_generated'] ? 1 : 0) : 1;

$stmt = $db->prepare('INSERT INTO categories (id, name, type, description, durees, active, theme_generated, account_id) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
$stmt->bindValue(1, $id, SQLITE3_TEXT);
$stmt->bindValue(2, $name, SQLITE3_TEXT);
$stmt->bindValue(3, $type, SQLITE3_TEXT);
$stmt->bindValue(4, $description, SQLITE3_TEXT);
$stmt->bindValue(5, $durees, SQLITE3_TEXT);
$stmt->bindValue(6, $themeGenerated, SQLITE3_INTEGER);
$stmt->bindValue(7, account_id(), SQLITE3_TEXT);
$stmt->execute();

http_response_code(200);
echo json_encode(["id" => $id]);
