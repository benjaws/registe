<?php
require __DIR__ . '/auth.php';
require_login_api();
// Gestion des musiques (suppression, activation, édition) — isolé par compte
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$db = db();
$aid = account_id();
$action = $input['action'] ?? '';
$musicId = $input['id'] ?? '';

switch ($action) {
    case 'delete':
        $st = $db->prepare('SELECT filename FROM musics WHERE id=? AND account_id=?');
        $st->bindValue(1, $musicId, SQLITE3_TEXT); $st->bindValue(2, $aid, SQLITE3_TEXT);
        $row = $st->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row && !empty($row['filename'])) {
            $filePath = __DIR__ . '/music/' . basename($row['filename']);
            if (file_exists($filePath)) @unlink($filePath);
        }
        $d = $db->prepare('DELETE FROM musics WHERE id=? AND account_id=?');
        $d->bindValue(1, $musicId, SQLITE3_TEXT); $d->bindValue(2, $aid, SQLITE3_TEXT); $d->execute();
        break;
    case 'toggle_active':
        $st = $db->prepare('SELECT active FROM musics WHERE id=? AND account_id=?');
        $st->bindValue(1, $musicId, SQLITE3_TEXT); $st->bindValue(2, $aid, SQLITE3_TEXT);
        $r = $st->execute()->fetchArray(SQLITE3_NUM);
        if ($r !== false) {
            $new = $r[0] ? 0 : 1;
            $u = $db->prepare('UPDATE musics SET active=? WHERE id=? AND account_id=?');
            $u->bindValue(1, $new, SQLITE3_INTEGER); $u->bindValue(2, $musicId, SQLITE3_TEXT); $u->bindValue(3, $aid, SQLITE3_TEXT);
            $u->execute();
        }
        break;
    case 'update':
        $types = isset($input['types']) ? json_encode($input['types'], JSON_UNESCAPED_UNICODE) : '[]';
        $u = $db->prepare('UPDATE musics SET title=?, transition=?, types=? WHERE id=? AND account_id=?');
        $u->bindValue(1, $input['title'] ?? '', SQLITE3_TEXT);
        $u->bindValue(2, !empty($input['transition']) ? 1 : 0, SQLITE3_INTEGER);
        $u->bindValue(3, $types, SQLITE3_TEXT);
        $u->bindValue(4, $musicId, SQLITE3_TEXT);
        $u->bindValue(5, $aid, SQLITE3_TEXT);
        $u->execute();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Action non valide']);
        exit;
}

echo json_encode(['success' => true]);
