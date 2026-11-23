<?php
// Séquences personnalisées (cues) : table + nettoyage des étapes.
// La table est créée à la volée pour les installations existantes.

function ensure_sequences_table() {
    db()->exec('CREATE TABLE IF NOT EXISTS sequences (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        trigger_on TEXT NOT NULL DEFAULT \'\',  -- "" (manuel) | start (au Jouer) | stop (au Stopper)
        is_loop INTEGER NOT NULL DEFAULT 0,
        steps TEXT NOT NULL,                -- JSON array
        position INTEGER NOT NULL DEFAULT 0,
        account_id TEXT
    )');
}

const SEQ_TRIGGERS = ['', 'start', 'stop'];
const SEQ_PRESETS = ['froid', 'chaud', 'rouge', 'vert', 'bleu'];
const SEQ_MAX_STEPS = 100;

function seq_num($v, $min, $max, $def = 0) {
    if (!is_numeric($v)) return $def;
    return max($min, min($max, round((float)$v, 2)));
}
function seq_str($v, $max) {
    return is_string($v) ? mb_substr(trim($v), 0, $max) : '';
}

// Ne garde que les types et champs connus, bornés
function sanitize_step($s) {
    if (!is_array($s)) return null;
    $type = $s['type'] ?? '';
    switch ($type) {
        case 'light':
            $color = $s['color'] ?? 'chaud';
            if (!in_array($color, SEQ_PRESETS, true) && !preg_match('/^#[0-9a-fA-F]{6}$/', (string)$color)) $color = 'chaud';
            $target = seq_str($s['target'] ?? 'all', 40);
            return ['type' => 'light', 'target' => $target !== '' ? $target : 'all', 'color' => strtolower($color),
                    'fade' => seq_num($s['fade'] ?? 0, 0, 600), 'parallel' => !empty($s['parallel'])];
        case 'intensity':
            return ['type' => 'intensity', 'level' => seq_num($s['level'] ?? 100, 0, 100, 100), 'fade' => seq_num($s['fade'] ?? 0, 0, 600),
                    'parallel' => !empty($s['parallel'])];
        case 'blackout':
        case 'lights_on':
        case 'go':
            return ['type' => $type];
        case 'wait':
            return ['type' => 'wait', 'seconds' => seq_num($s['seconds'] ?? 1, 0, 3600, 1)];
        case 'music':
            return ['type' => 'music', 'file' => seq_str($s['file'] ?? '', 255), 'start' => seq_num($s['start'] ?? 0, 0, 36000),
                    'volume' => seq_num($s['volume'] ?? 100, 0, 100, 100)];
        case 'music_stop':
            return ['type' => 'music_stop', 'fade' => seq_num($s['fade'] ?? 1.5, 0, 60, 1.5)];
        case 'spotify':
            $a = $s['action'] ?? 'play';
            if (!in_array($a, ['play', 'pause', 'next', 'link'], true)) $a = 'play';
            return ['type' => 'spotify', 'action' => $a, 'link' => $a === 'link' ? seq_str($s['link'] ?? '', 300) : ''];
        case 'chrono':
            $a = ($s['action'] ?? '') === 'stop' ? 'stop' : 'start';
            return ['type' => 'chrono', 'action' => $a];
    }
    return null;
}

function sanitize_steps($steps) {
    if (!is_array($steps)) return [];
    $out = [];
    foreach (array_slice($steps, 0, SEQ_MAX_STEPS) as $s) {
        $c = sanitize_step($s);
        if ($c) $out[] = $c;
    }
    return $out;
}

function list_sequences() {
    ensure_sequences_table();
    $st = db()->prepare('SELECT * FROM sequences WHERE account_id = ? ORDER BY position, name');
    $st->bindValue(1, account_id(), SQLITE3_TEXT);
    $res = $st->execute();
    $list = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $list[] = [
            'id' => $row['id'], 'name' => $row['name'], 'trigger' => $row['trigger_on'],
            'loop' => (bool)$row['is_loop'], 'position' => (int)$row['position'],
            'steps' => json_decode($row['steps'], true) ?: [],
        ];
    }
    return $list;
}
