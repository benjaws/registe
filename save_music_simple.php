<?php
require __DIR__ . '/auth.php';
require_login_api();
// Script simple pour upload de musique - version de base qui marchait
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(["error" => "Méthode non-POST"]);
    exit;
}


$logFile = __DIR__.'/log_music_simple.txt';
file_put_contents($logFile, date('c')." Upload simple\n", FILE_APPEND);
file_put_contents($logFile, "POST: ".json_encode($_POST)."\n", FILE_APPEND);
file_put_contents($logFile, "FILES: ".json_encode($_FILES)."\n", FILE_APPEND);
$tmpDir = sys_get_temp_dir();
$tmpWritable = is_writable($tmpDir);
file_put_contents($logFile, "TMP: $tmpDir, writable: ".($tmpWritable ? 'oui' : 'non')."\n", FILE_APPEND);

if (!isset($_FILES['mp3file']) || $_FILES['mp3file']['error'] !== UPLOAD_ERR_OK) {
    file_put_contents($logFile, "Erreur fichier: ".$_FILES['mp3file']['error']."\n", FILE_APPEND);
    http_response_code(400);
    echo json_encode(['error' => 'Erreur upload', 'details' => $_FILES['mp3file']]);
    exit;
}

$musicDir = __DIR__ . '/music';
if (!is_dir($musicDir)) mkdir($musicDir, 0775, true);

$filename = basename($_FILES['mp3file']['name']);
$target = $musicDir . '/' . uniqid('music_') . '.mp3';

if (!move_uploaded_file($_FILES['mp3file']['tmp_name'], $target)) {
    file_put_contents($logFile, "Échec move_uploaded_file\n", FILE_APPEND);
    http_response_code(500);
    echo json_encode(['error' => 'Échec copie fichier']);
    exit;
}


// Ajout dans la base SQLite
$title = $_POST['title'] ?? pathinfo($filename, PATHINFO_FILENAME);
$transition = !empty($_POST['transition']);
$types = isset($_POST['types']) ? (array)$_POST['types'] : [];
$dbFile = __DIR__ . '/data/impro.sqlite';
if (!file_exists($dbFile)) {
    file_put_contents($logFile, "Fichier DB introuvable: $dbFile\n", FILE_APPEND);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(["error" => "Fichier DB introuvable", "dbFile" => $dbFile]);
    exit;
}
$db = new SQLite3($dbFile);
$id = uniqid();
$typesJson = json_encode($types, JSON_UNESCAPED_UNICODE);
try {
    $stmt = $db->prepare('INSERT INTO musics (id, filename, title, transition, types, active, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $id, SQLITE3_TEXT);
    $stmt->bindValue(2, basename($target), SQLITE3_TEXT);
    $stmt->bindValue(3, $title, SQLITE3_TEXT);
    $stmt->bindValue(4, $transition ? 1 : 0, SQLITE3_INTEGER);
    $stmt->bindValue(5, $typesJson, SQLITE3_TEXT);
    $stmt->bindValue(6, 1, SQLITE3_INTEGER);
    $stmt->bindValue(7, account_id(), SQLITE3_TEXT);
    $res = $stmt->execute();
    if (!$res) {
        throw new Exception($db->lastErrorMsg());
    }
    file_put_contents($logFile, "Upload OK (DB)\n", FILE_APPEND);
    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode(['success' => true, 'id' => $id]);
} catch (Exception $e) {
    file_put_contents($logFile, "Erreur SQL: ".$e->getMessage()."\n", FILE_APPEND);
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["error" => "Erreur SQL: " . $e->getMessage()]);
    exit;
}
