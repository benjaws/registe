<?php
require __DIR__ . '/../auth.php';
require_login_api();
// Sert les catégories du compte connecté
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$st = db()->prepare('SELECT * FROM categories WHERE account_id = ?');
$st->bindValue(1, account_id(), SQLITE3_TEXT);
$res = $st->execute();
$cats = [];
while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
    $row['durees'] = json_decode($row['durees'], true);
    $row['active'] = (bool)$row['active'];
    $row['theme_generated'] = (bool)($row['theme_generated'] ?? 1);
    $cats[] = $row;
}
echo json_encode($cats, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
