<?php
require __DIR__ . '/auth.php';
require_login_api();
// Enregistre une catégorie dans la base SQLite

$input = json_decode(file_get_contents('php://input'), true);
$dbFile = __DIR__ . '/data/impro.sqlite';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(["error" => "Fichier DB introuvable", "dbFile" => $dbFile]);
    exit;
}
$db = new SQLite3($dbFile);

// Vérification des champs obligatoires
if (!isset($input['name'], $input['type'], $input['description'], $input['durees'])) {
    http_response_code(400);
    echo json_encode(["error" => "Champs manquants", "input" => $input]);
    exit;
}

// Générer un ID unique (compatible avec l'ancien uniqid)
$id = uniqid();
$name = $db->escapeString($input['name']);
$type = $db->escapeString($input['type']);
$description = $db->escapeString($input['description']);
$durees = json_encode($input['durees'], JSON_UNESCAPED_UNICODE);
$active = 1;
$themeGenerated = array_key_exists('theme_generated', $input) ? ($input['theme_generated'] ? 1 : 0) : 1;

try {
    $stmt = $db->prepare('INSERT INTO categories (id, name, type, description, durees, active, theme_generated, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $id, SQLITE3_TEXT);
    $stmt->bindValue(2, $name, SQLITE3_TEXT);
    $stmt->bindValue(3, $type, SQLITE3_TEXT);
    $stmt->bindValue(4, $description, SQLITE3_TEXT);
    $stmt->bindValue(5, $durees, SQLITE3_TEXT);
    $stmt->bindValue(6, $active, SQLITE3_INTEGER);
    $stmt->bindValue(7, $themeGenerated, SQLITE3_INTEGER);
    $stmt->bindValue(8, account_id(), SQLITE3_TEXT);
    $res = $stmt->execute();
    if (!$res) {
        throw new Exception($db->lastErrorMsg());
    }
    http_response_code(200);
    echo json_encode(["id" => $id]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Erreur SQL: " . $e->getMessage()]);
    exit;
}
