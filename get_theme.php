<?php
require __DIR__ . '/auth.php';
require_login_api();
// get_theme.php : Appelle l'API OpenAI pour générer un thème d'impro
// Désactive l'affichage des erreurs pour éviter toute sortie parasite
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$themeHistory = [];
if (isset($input['themeHistory']) && is_array($input['themeHistory'])) {
    $themeHistory = $input['themeHistory'];
}

// Construction d'un texte d'historique pour le prompt
$themeHistoryText = '';
if (count($themeHistory) > 0) {
    $themeHistoryText = "Voici les 10 derniers thèmes générés :\n";
    foreach ($themeHistory as $item) {
        $themeHistoryText .= '- ' . (isset($item['theme']) ? $item['theme'] : '') . "\n";
    }
    $themeHistoryText .= "\nEssaie d'alterner le style du prochain thème par rapport à cet historique.\n";
    $themeHistoryText .= "Parfois, propose un titre qui donne un enjeu clair, parfois un titre décalé qui ne va pas avec la catégorie, parfois un titre permettant plusieurs interprétations, parfois un titre très spécifique. Diversifie les styles et l'approche à chaque fois.\n";
}

$categorie = $input['categorie'] ?? '';
$type = $input['type'] ?? '';
$description = $input['description'] ?? '';

// Lecture de la clé API depuis un fichier .env local
$envFile = __DIR__ . '/.env';
$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey && file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, 'OPENAI_API_KEY=') === 0) {
            $apiKey = substr($line, strlen('OPENAI_API_KEY='));
            break;
        }
    }
}
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['theme' => 'API key manquante']);
    exit;
}


$prompt =
    ($themeHistoryText ? $themeHistoryText . "\n" : '') .
    "Génère un titre de thème original pour une improvisation théâtrale.\n" .
    "Le thème doit être ouvert, inspirant, permettre plusieurs interprétations et stimuler l'imagination.\n" .
    "Évite les thèmes trop longs, fermés, polémiques, grossiers, choquants ou liés à l'actualité.\n" .
    "Inspire-toi de situations du quotidien, de lieux, d'objets, de métiers, d'émotions, de styles musicaux, de genres de films ou de concepts abstraits.\n" .
    "Exemples : Une chaise oubliée, Un rendez-vous manqué, La peur du vide, Un astronaute perdu, Le temps qui passe, Un café à minuit, La liberté retrouvée.\n" .
    "Catégorie : $categorie\n" .
    ($type ? "Type : $type\n" : '') .
    ($description ? "Description : $description\n" : '') .
    "Le titre doit être court (max 12 mots), original, et donner envie de jouer.\n" .
    "Réponds uniquement par le titre, sans phrase d'introduction.";


$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'model' => 'gpt-4.1',
    'messages' => [
        ['role' => 'user', 'content' => $prompt]
    ],
    'max_tokens' => 2048,
    'temperature' => 0.2
]));

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(500);
    echo json_encode(['theme' => 'Erreur API: ' . curl_error($ch)]);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['theme' => 'Erreur API (HTTP ' . $httpCode . ')']);
    exit;
}

$data = json_decode($response, true);
$content = $data['choices'][0]['message']['content'] ?? '';
$lines = array_filter(array_map('trim', explode("\n", $content)));
$theme = count($lines) ? $lines[0] : 'Erreur API';
echo json_encode(['theme' => trim($theme)]);
