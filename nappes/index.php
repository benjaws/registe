<?php
require __DIR__ . '/../auth.php';
require_login_api();
// Liste les boucles sonores déposées ici (remplacent les nappes synthétisées de l'Ambiance)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$files = array_values(array_filter(scandir(__DIR__), fn($f) => preg_match('/\.(mp3|ogg|wav|m4a)$/i', $f)));
echo json_encode($files, JSON_UNESCAPED_UNICODE);
