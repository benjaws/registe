<?php
// Créer un fichier .htaccess pour protéger l'application et augmenter les limites d'upload
$dir = __DIR__;
$htaccess = $dir . '/.htaccess';
$htpasswd = $dir . '/.htpasswd';

$content = "# Protection par mot de passe\n" .
"AuthType Basic\n" .
"AuthName \"Accès restreint\"\n" .
"AuthUserFile $htpasswd\n" .
"Require valid-user\n\n" .
"# Augmentation des limites d'upload\n" .
"php_value upload_max_filesize 50M\n" .
"php_value post_max_size 50M\n" .
"php_value max_execution_time 300\n" .
"php_value max_input_time 300\n" .
"php_value memory_limit 256M\n";

file_put_contents($htaccess, $content);

if (!file_exists($htpasswd)) {
    $defaultUser = 'admin';
    $defaultPassHash = '$apr1$QyTSHrVy$5Bci.DCJsEIL/RQCg9v6Q/';
    file_put_contents($htpasswd, "$defaultUser:$defaultPassHash\n");
    echo "Fichier .htpasswd créé avec utilisateur 'admin' et mot de passe 'changeme'.\n";
}

echo "Fichier .htaccess créé avec des limites d'upload augmentées et protection par mot de passe.\n";
echo "Si ça ne marche pas, il faut modifier php.ini sur le serveur.\n";
?>
