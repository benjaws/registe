<?php
require __DIR__ . '/auth.php';
logout_account();
header('Location: index.php');
exit;
