<?php
echo "<h3>Configuration PHP actuelle :</h3>";
echo "upload_max_filesize : " . ini_get('upload_max_filesize') . "<br>";
echo "post_max_size : " . ini_get('post_max_size') . "<br>";
echo "max_execution_time : " . ini_get('max_execution_time') . "<br>";
echo "memory_limit : " . ini_get('memory_limit') . "<br>";
echo "max_file_uploads : " . ini_get('max_file_uploads') . "<br>";

// Essayer de modifier via ini_set
echo "<h3>Tentative de modification via ini_set :</h3>";
echo "upload_max_filesize avant : " . ini_get('upload_max_filesize') . "<br>";
ini_set('upload_max_filesize', '50M');
echo "upload_max_filesize après : " . ini_get('upload_max_filesize') . "<br>";

echo "post_max_size avant : " . ini_get('post_max_size') . "<br>";
ini_set('post_max_size', '50M');
echo "post_max_size après : " . ini_get('post_max_size') . "<br>";

// Convertir en bytes pour voir la vraie limite
function convertToBytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g': $val *= 1024;
        case 'm': $val *= 1024;
        case 'k': $val *= 1024;
    }
    return $val;
}

echo "<h3>Limites en bytes :</h3>";
echo "upload_max_filesize : " . convertToBytes(ini_get('upload_max_filesize')) . " bytes<br>";
echo "post_max_size : " . convertToBytes(ini_get('post_max_size')) . " bytes<br>";

// Taille de ton fichier pour comparaison
$file = "/workspaces/registe/music/Kungs - Clap Your Hands.mp3";
if (file_exists($file)) {
    echo "<h3>Ton fichier :</h3>";
    echo "Taille : " . filesize($file) . " bytes<br>";
}
?>
