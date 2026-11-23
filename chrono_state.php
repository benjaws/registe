<?php
require __DIR__ . '/auth.php';
require_login_api();
// État partagé du chronomètre entre la page principale et la page tablette.
// GET  -> renvoie l'état courant + l'heure serveur (pour synchro).
// POST -> met à jour l'état { action: 'start'|'stop'|'reset', duree, theme }

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$stateFile = __DIR__ . '/data/chrono_state_' . account_id() . '.json';

function readState($file) {
    if (!file_exists($file)) {
        return ['state' => 'idle', 'duree' => 0, 'startedAt' => 0, 'endAt' => 0, 'theme' => '', 'updatedAt' => 0];
    }
    $raw = @file_get_contents($file);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return ['state' => 'idle', 'duree' => 0, 'startedAt' => 0, 'endAt' => 0, 'theme' => '', 'updatedAt' => 0];
    }
    return $data;
}

function writeState($file, $data) {
    $fp = fopen($file, 'c+');
    if ($fp) {
        flock($fp, LOCK_EX);
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    } else {
        file_put_contents($file, json_encode($data));
    }
}

$now = microtime(true);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) { $input = $_POST; }
    $action = isset($input['action']) ? $input['action'] : '';
    $state = readState($stateFile);

    if ($action === 'start') {
        $duree = isset($input['duree']) ? (int)$input['duree'] : 0;
        $state = [
            'state'     => 'running',
            'duree'     => $duree,
            'startedAt' => $now,
            'endAt'     => $now + $duree,
            'theme'     => isset($input['theme']) ? (string)$input['theme'] : '',
            'updatedAt' => $now,
        ];
    } elseif ($action === 'stop') {
        $state['state'] = 'stopped';
        $state['updatedAt'] = $now;
    } elseif ($action === 'reset') {
        $state = ['state' => 'idle', 'duree' => 0, 'startedAt' => 0, 'endAt' => 0, 'theme' => '', 'updatedAt' => $now];
    } elseif ($action === 'command') {
        // Commande envoyée depuis la tablette, exécutée par la page principale
        $state['cmd'] = ['name' => (string)($input['cmd'] ?? ''), 'ts' => $now];
        $state['updatedAt'] = $now;
    }
    writeState($stateFile, $state);
    $state['serverNow'] = $now;
    echo json_encode($state);
    exit;
}

// GET
$state = readState($stateFile);
$state['serverNow'] = $now;
echo json_encode($state);
