<?php
require __DIR__ . '/../auth.php';
require __DIR__ . '/../sequences_db.php';
require_login_api();
// Sert les séquences du compte connecté
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(list_sequences(), JSON_UNESCAPED_UNICODE);
