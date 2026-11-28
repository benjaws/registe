<?php
require __DIR__ . '/auth.php';
require_login_api();
// Ambiance : deux mots entendus → preset lumière + nappe sonore.
//   GET  ?q=…                      suggestions (presets + ambiances apprises)
//   GET  (sans q)                  liste complète
//   POST {text}                    résout : presets → appris → Gemini (puis appris) → approché
//   POST {action:'forget', id}     oublie une ambiance apprise
// Les ambiances inventées par Gemini sont retenues par compte : la 2e fois, c'est instantané.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const AMB_EFFECTS = ['static', 'fire', 'candle', 'pulse', 'flicker', 'storm', 'heartbeat', 'wave'];
const AMB_LAYERS = ['drone', 'wind', 'rain', 'fire', 'hum', 'heartbeat', 'waves', 'crowd', 'birds', 'bells', 'drip', 'clock'];
const AMB_MOODS = ['sombre', 'chaud', 'tendu', 'clair', 'etrange', 'joyeux'];
const AMB_STOP = ['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'en', 'et', 'dans', 'sur',
                  'sous', 'avec', 'pour', 'par'];

$db = db();
$aid = account_id();
$db->exec('CREATE TABLE IF NOT EXISTS ambiances (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    learned_from TEXT NOT NULL,
    data TEXT NOT NULL,          -- JSON du preset
    created_at TEXT NOT NULL
)');

function fail($code, $msg) { http_response_code($code); echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE); exit; }

function env_value($key, $default = '') {
    $v = getenv($key);
    if ($v !== false && $v !== '') return $v;
    static $env = null;
    if ($env === null) {
        $env = [];
        $f = __DIR__ . '/.env';
        if (is_file($f)) foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
            if (preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/', $l, $m)) $env[$m[1]] = trim($m[2], " \t\"'");
        }
    }
    return $env[$key] ?? $default;
}

// minuscules, sans accents ni ponctuation
function amb_norm($s) {
    $s = mb_strtolower((string)$s, 'UTF-8');
    $s = strtr($s, ['à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ç'=>'c','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','î'=>'i','ï'=>'i',
                    'í'=>'i','ô'=>'o','ö'=>'o','ó'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ú'=>'u','ÿ'=>'y','ñ'=>'n','œ'=>'oe','æ'=>'ae']);
    return trim(preg_replace('/[^a-z0-9 ]+/', ' ', $s));
}
function amb_tokens($s) {
    $out = [];
    foreach (preg_split('/\s+/', amb_norm($s), -1, PREG_SPLIT_NO_EMPTY) as $w) {
        if (strlen($w) < 2 || in_array($w, AMB_STOP, true)) continue;
        if (strlen($w) > 4 && substr($w, -3) === 'aux') $w = substr($w, 0, -3) . 'al';      // hôpitaux → hopital
        elseif (strlen($w) > 3 && substr($w, -1) === 's' && substr($w, -2) !== 'ss') $w = substr($w, 0, -1);
        $out[] = $w;
    }
    return $out;
}

function amb_presets($db, $aid) {
    $list = json_decode(file_get_contents(__DIR__ . '/data/ambiance_presets.json'), true) ?: [];
    $st = $db->prepare('SELECT data FROM ambiances WHERE account_id = ? ORDER BY created_at');
    $st->bindValue(1, $aid, SQLITE3_TEXT);
    $res = $st->execute();
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $p = json_decode($row['data'], true);
        if ($p) $list[] = $p;
    }
    return $list;
}

// Presets classés : part des mots reconnus (fautes de frappe tolérées)
function amb_ranked($text, $presets) {
    $q = amb_tokens($text);
    if (!$q) return [];
    $out = [];
    foreach ($presets as $p) {
        $kws = [];
        foreach (array_merge($p['keywords'] ?? [], [$p['name']]) as $k) foreach (amb_tokens($k) as $t) $kws[$t] = true;
        $score = 0;
        foreach ($q as $w) {
            if (isset($kws[$w])) { $score += 1; continue; }
            if (strlen($w) < 4) continue;
            foreach (array_keys($kws) as $k) {
                if (abs(strlen($k) - strlen($w)) <= 2 && levenshtein($w, $k) <= (strlen($w) >= 7 ? 2 : 1)) { $score += 0.8; break; }
            }
        }
        $score /= count($q);
        if (!empty($p['learned_from']) && amb_norm($p['learned_from']) === amb_norm($text)) $score = 2;
        if ($score > 0) { $p['score'] = round($score, 2); $out[] = $p; }
    }
    usort($out, fn($a, $b) => $b['score'] <=> $a['score']);
    return $out;
}

function amb_clean($d, $text) {
    $num = fn($v, $min, $max, $def) => is_numeric($v) ? max($min, min($max, (float)$v)) : $def;
    $cols = array_values(array_filter((array)($d['colors'] ?? []), fn($c) => is_string($c) && preg_match('/^#[0-9a-fA-F]{6}$/', $c)));
    $layers = [];
    foreach ((array)($d['sound']['layers'] ?? []) as $k => $v) {
        if (in_array($k, AMB_LAYERS, true) && is_numeric($v) && $v > 0) $layers[$k] = round(min(1, (float)$v), 2);
    }
    $mood = $d['sound']['mood'] ?? '';
    return [
        'id' => 'appris-' . substr(md5(amb_norm($text)), 0, 10),
        'name' => mb_substr(trim((string)($d['name'] ?? '')) ?: $text, 0, 40),
        'emoji' => '✨',
        'colors' => array_slice($cols ?: ['#ffcc88'], 0, 4),
        'intensity' => (int)$num($d['intensity'] ?? null, 15, 100, 70),
        'effect' => in_array($d['effect'] ?? '', AMB_EFFECTS, true) ? $d['effect'] : 'static',
        'fade' => round($num($d['fade'] ?? null, 0.5, 8, 2.5), 1),
        'sound' => ['mood' => in_array($mood, AMB_MOODS, true) ? $mood : 'sombre', 'layers' => $layers ?: ['drone' => 0.5]],
        'keywords' => array_slice(array_values(array_filter((array)($d['keywords'] ?? []), 'is_string')), 0, 8),
        'learned_from' => mb_substr($text, 0, 80),
    ];
}

function amb_ask_gemini($text) {
    $key = env_value('GEMINI_API_KEY');
    if ($key === '') throw new Exception('GEMINI_API_KEY non configurée');
    $model = env_value('GEMINI_MODEL', 'gemini-3.8-flash');
    $layersProps = [];
    foreach (AMB_LAYERS as $l) $layersProps[$l] = ['type' => 'number'];
    $schema = [
        'type' => 'object',
        'properties' => [
            'name' => ['type' => 'string'],
            'colors' => ['type' => 'array', 'items' => ['type' => 'string'], 'minItems' => 1, 'maxItems' => 4],
            'intensity' => ['type' => 'integer'],
            'effect' => ['type' => 'string', 'enum' => AMB_EFFECTS],
            'fade' => ['type' => 'number'],
            'sound' => ['type' => 'object', 'properties' => [
                'mood' => ['type' => 'string', 'enum' => AMB_MOODS],
                'layers' => ['type' => 'object', 'properties' => $layersProps],
            ], 'required' => ['mood', 'layers']],
            'keywords' => ['type' => 'array', 'items' => ['type' => 'string']],
        ],
        'required' => ['name', 'colors', 'intensity', 'effect', 'fade', 'sound', 'keywords'],
    ];
    $system = "Tu es régisseur lumière et son d'un spectacle d'improvisation théâtrale.\n"
        . "On te donne un lieu ou une situation en deux ou trois mots. Tu inventes l'ambiance.\n"
        . "- colors : 1 à 4 couleurs #RRGGBB réparties sur les projecteurs (saturées pour le fantastique, ambrées pour l'intime, bleutées pour la nuit ou le froid).\n"
        . "- intensity : 0 à 100 (lieu sombre 20-45, intérieur 60-80, plein soleil 90-100). Les acteurs doivent rester visibles : jamais sous 15.\n"
        . "- effect : static=fixe, fire=flammes, candle=bougie, pulse=respiration lente, flicker=néon défaillant, storm=orage/éclairs, heartbeat=battement de cœur, wave=vagues d'un projecteur à l'autre.\n"
        . "- fade : transition en secondes (1 à 6).\n"
        . "- sound.mood : " . implode(', ', AMB_MOODS) . ".\n"
        . "- sound.layers : 1 à 4 couches parmi " . implode(', ', AMB_LAYERS) . ", volume 0.1 à 1. drone=nappe tenue (presque toujours utile), hum=bourdonnement électrique, crowd=brouhaha, drip=gouttes, clock=tic-tac.\n"
        . "- keywords : 4 à 8 mots français proches (lieux ou situations similaires), au singulier.\n"
        . "- name : nom court de l'ambiance en français.\nRéponds uniquement en JSON.";
    $post = function ($config) use ($model, $key, $system, $text) {
        $ch = curl_init(rtrim(env_value('GEMINI_URL', 'https://generativelanguage.googleapis.com/v1beta'), '/') . '/models/' . rawurlencode($model) . ':generateContent');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $key],
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => (int)env_value('GEMINI_TIMEOUT', '10'),
            CURLOPT_POSTFIELDS => json_encode([
                'systemInstruction' => ['parts' => [['text' => $system]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $text]]]],
                'generationConfig' => $config,
            ], JSON_UNESCAPED_UNICODE),
        ]);
        $res = curl_exec($ch);
        if ($res === false) { $e = curl_error($ch); curl_close($ch); throw new Exception($e); }
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$code, json_decode($res, true)];
    };
    // Schéma JSON strict + réflexion minimale (vitesse) ; si le modèle refuse ces options, JSON simple.
    $base = ['responseMimeType' => 'application/json', 'temperature' => 0.6, 'maxOutputTokens' => 600];
    [$code, $data] = $post($base + ['responseJsonSchema' => $schema, 'thinkingConfig' => ['thinkingLevel' => 'minimal']]);
    if ($code === 400) [$code, $data] = $post($base);
    if ($code !== 200) throw new Exception("HTTP $code" . (isset($data['error']['message']) ? ' : ' . mb_substr($data['error']['message'], 0, 120) : ''));
    $content = '';
    foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
        if (empty($part['thought'])) $content .= $part['text'] ?? '';
    }
    $d = json_decode($content, true);
    if (!is_array($d)) throw new Exception('réponse illisible');
    return amb_clean($d, $text);
}

$slim = fn($p) => ['id' => $p['id'], 'name' => $p['name'], 'emoji' => $p['emoji'] ?? '', 'score' => $p['score'] ?? null];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    session_write_close();
    $all = amb_presets($db, $aid);
    if (isset($_GET['q'])) {
        echo json_encode(array_map($slim, array_slice(amb_ranked((string)$_GET['q'], $all), 0, 5)), JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['presets' => $all, 'llm' => env_value('GEMINI_API_KEY') !== '', 'model' => env_value('GEMINI_MODEL', 'gemini-3.8-flash')],
                         JSON_UNESCAPED_UNICODE);
    }
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
// Libère la session : un appel Gemini lent ne doit pas bloquer le chrono ni les autres requêtes
session_write_close();

if (($input['action'] ?? '') === 'forget') {
    $st = $db->prepare('DELETE FROM ambiances WHERE id = ? AND account_id = ?');
    $st->bindValue(1, (string)($input['id'] ?? ''), SQLITE3_TEXT);
    $st->bindValue(2, $aid, SQLITE3_TEXT);
    $st->execute();
    echo json_encode(['ok' => true]);
    exit;
}

$t0 = microtime(true);
$all = amb_presets($db, $aid);
$ms = fn() => (int)round((microtime(true) - $t0) * 1000);

if (!empty($input['id'])) {
    foreach ($all as $p) if ($p['id'] === $input['id']) {
        echo json_encode(['preset' => $p, 'source' => isset($p['learned_from']) ? 'appris' : 'preset', 'ms' => $ms()], JSON_UNESCAPED_UNICODE);
        exit;
    }
    fail(404, 'Ambiance inconnue');
}

$text = mb_substr(trim((string)($input['text'] ?? '')), 0, 80);
if ($text === '') fail(400, 'Tape un lieu ou une situation');

$ranked = amb_ranked($text, $all);
if ($ranked && $ranked[0]['score'] >= 0.8) {
    $p = $ranked[0];
    echo json_encode(['preset' => $p, 'source' => isset($p['learned_from']) ? 'appris' : 'preset', 'ms' => $ms()], JSON_UNESCAPED_UNICODE);
    exit;
}

$warning = null;
if (empty($input['noLlm'])) {
    try {
        $p = amb_ask_gemini($text);
        $p['id'] .= '-' . substr(md5($aid), 0, 6);   // id unique entre comptes
        $st = $db->prepare('INSERT OR REPLACE INTO ambiances (id, account_id, learned_from, data, created_at) VALUES (?,?,?,?,?)');
        $st->bindValue(1, $p['id'], SQLITE3_TEXT);
        $st->bindValue(2, $aid, SQLITE3_TEXT);
        $st->bindValue(3, $text, SQLITE3_TEXT);
        $st->bindValue(4, json_encode($p, JSON_UNESCAPED_UNICODE), SQLITE3_TEXT);
        $st->bindValue(5, date('c'), SQLITE3_TEXT);
        $st->execute();
        echo json_encode(['preset' => $p, 'source' => 'gemini', 'ms' => $ms()], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e) {
        $warning = 'Gemini indisponible (' . $e->getMessage() . ')';
    }
}
// Repli : le preset qui reconnaît au moins un mot sur deux
if ($ranked && $ranked[0]['score'] >= 0.5) {
    echo json_encode(['preset' => $ranked[0], 'source' => 'approché', 'warning' => $warning, 'ms' => $ms()], JSON_UNESCAPED_UNICODE);
    exit;
}
fail(404, 'Aucune ambiance pour « ' . $text . ' »' . ($warning ? ' — ' . $warning : ''));
