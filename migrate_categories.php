<?php
// Migration des catégories existantes pour ajouter les champs manquants
$file = __DIR__ . '/data/categories.json';
if (file_exists($file)) {
    $cats = json_decode(file_get_contents($file), true);
    $modified = false;
    
    for ($i = 0; $i < count($cats); $i++) {
        // Ajouter un ID unique si manquant
        if (!isset($cats[$i]['id'])) {
            $cats[$i]['id'] = uniqid();
            $modified = true;
        }
        
        // Ajouter le statut actif par défaut si manquant
        if (!isset($cats[$i]['active'])) {
            $cats[$i]['active'] = true;
            $modified = true;
        }
    }
    
    if ($modified) {
        file_put_contents($file, json_encode($cats, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
        echo "Migration terminée avec succès.\n";
    } else {
        echo "Aucune migration nécessaire.\n";
    }
} else {
    echo "Fichier categories.json non trouvé.\n";
}
?>
