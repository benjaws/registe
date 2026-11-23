<?php
require __DIR__ . '/../auth.php';
require_login_api();
// Sert les musiques du compte connecté
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
$st = db()->prepare('SELECT * FROM musics WHERE account_id = ?');
$st->bindValue(1, account_id(), SQLITE3_TEXT);
$res = $st->execute();
$musics = [];
while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
    $row['types'] = json_decode($row['types'], true);
    $row['active'] = (bool)$row['active'];
    $musics[] = $row;
}
echo json_encode($musics, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
