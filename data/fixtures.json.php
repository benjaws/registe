<?php
require __DIR__ . '/../auth.php';
require_login_api();
// Sert les projecteurs du compte connecté
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$st = db()->prepare('SELECT * FROM fixtures WHERE account_id = ? ORDER BY position, address');
$st->bindValue(1, account_id(), SQLITE3_TEXT);
$res = $st->execute();
$list = [];
while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
    $row['address'] = (int)$row['address'];
    $row['position'] = (int)$row['position'];
    $list[] = $row;
}
echo json_encode($list, JSON_UNESCAPED_UNICODE);
