<?php
header('Content-Type: application/json');
// Vérifie que la requête est bien POST (upload de fichier)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(400);
    echo json_encode([
        "error" => "Requête non-POST",
        "method" => $_SERVER['REQUEST_METHOD'],
        "expected" => 'POST',
        "_FILES" => $_FILES,
        "_POST" => $_POST
    ]);
    exit;
}
// Upload d'un fichier mp3
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$logFile = __DIR__.'/log_music.txt';
file_put_contents($logFile, date('c')." Début script\n", FILE_APPEND);

// Vérifie les champs obligatoires côté POST
$title = $_POST['title'] ?? pathinfo($_FILES['mp3file']['name'] ?? '', PATHINFO_FILENAME);
$transition = !empty($_POST['transition']);
$types = isset($_POST['types']) ? (array)$_POST['types'] : [];
$log = "POST: ".json_encode($_POST)."\n";
$log .= "FILES: ".json_encode($_FILES)."\n";
file_put_contents($logFile, $log, FILE_APPEND);

$musicDir = __DIR__ . '/music';
if(!is_dir($musicDir)) mkdir($musicDir, 0775, true);

// Vérifie si le fichier mp3 est présent
if (!isset($_FILES['mp3file'])) {
    $log .= "Aucun fichier reçu\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(400);
    echo json_encode(['error' => 'Aucun fichier reçu']);
    exit;
}

$fileError = $_FILES['mp3file']['error'];
if ($fileError !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Fichier trop volumineux (limite serveur)',
        UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux (limite formulaire)', 
        UPLOAD_ERR_PARTIAL => 'Fichier partiellement uploadé',
        UPLOAD_ERR_NO_FILE => 'Aucun fichier uploadé',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant',
        UPLOAD_ERR_CANT_WRITE => 'Impossible d\'écrire le fichier',
        UPLOAD_ERR_EXTENSION => 'Upload stoppé par extension'
    ];
    $errorMsg = $errorMessages[$fileError] ?? "Erreur upload inconnue ($fileError)";
    $log .= "Erreur upload: $errorMsg\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(400);
    echo json_encode(['error' => $errorMsg, 'error_code' => $fileError]);
    exit;
}

$filename = basename($_FILES['mp3file']['name']);
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
if($ext !== 'mp3') {
    $log .= "Format non supporté\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(400);
    echo json_encode(['error' => 'Format non supporté']);
    exit;
}

$target = $musicDir . '/' . uniqid('music_') . '.mp3';
if (!move_uploaded_file($_FILES['mp3file']['tmp_name'], $target)) {
    $log .= "Erreur lors de la copie du fichier\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(500);
    echo json_encode(['error' => 'Erreur lors de la copie du fichier']);
    exit;
}


// Insertion dans la base SQLite
$dbFile = __DIR__ . '/data/impro.sqlite';
if (!file_exists($dbFile)) {
    $log .= "Fichier DB introuvable: $dbFile\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(500);
    echo json_encode(["error" => "Fichier DB introuvable", "dbFile" => $dbFile]);
    exit;
}
$db = new SQLite3($dbFile);
$id = uniqid();
$typesJson = json_encode($types, JSON_UNESCAPED_UNICODE);
try {
    $stmt = $db->prepare('INSERT INTO musics (id, filename, title, transition, types, active) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $id, SQLITE3_TEXT);
    $stmt->bindValue(2, basename($target), SQLITE3_TEXT);
    $stmt->bindValue(3, $title, SQLITE3_TEXT);
    $stmt->bindValue(4, $transition ? 1 : 0, SQLITE3_INTEGER);
    $stmt->bindValue(5, $typesJson, SQLITE3_TEXT);
    $stmt->bindValue(6, 1, SQLITE3_INTEGER);
    $res = $stmt->execute();
    if (!$res) {
        throw new Exception($db->lastErrorMsg());
    }
    $log .= "Musique ajoutée OK (DB)\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(200);
    echo json_encode(['success' => true, 'id' => $id]);
} catch (Exception $e) {
    $log .= "Erreur SQL: ".$e->getMessage()."\n";
    file_put_contents($logFile, $log, FILE_APPEND);
    http_response_code(500);
    echo json_encode(["error" => "Erreur SQL: " . $e->getMessage()]);
    exit;
}
