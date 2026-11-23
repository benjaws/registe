<?php
// Script d'initialisation de la base SQLite pour impro
$dbFile = __DIR__ . '/impro.sqlite';
if (file_exists($dbFile)) {
    echo "La base existe déjà : $dbFile\n";
    exit(0);
}
$db = new SQLite3($dbFile);

// Table comptes (compagnies + super-admin)
$db->exec('CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT "company",   -- superadmin | company
    status TEXT NOT NULL DEFAULT "pending", -- pending | active | suspended
    created_at TEXT NOT NULL
)');

// Table catégories
$db->exec('CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    durees TEXT NOT NULL, -- JSON array
    active INTEGER NOT NULL DEFAULT 1,
    theme_generated INTEGER NOT NULL DEFAULT 1,
    account_id TEXT
)');

// Table musiques
$db->exec('CREATE TABLE musics (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    title TEXT,
    transition INTEGER NOT NULL DEFAULT 0,
    types TEXT NOT NULL, -- JSON array
    active INTEGER NOT NULL DEFAULT 1,
    account_id TEXT
)');

// Table projecteurs (fixtures)
$db->exec('CREATE TABLE fixtures (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address INTEGER NOT NULL,
    type TEXT NOT NULL,          -- RGB | RGBW | RGB_DIM | DIM_RGB | RGBW_DIM | DIM_RGBW
    position INTEGER NOT NULL DEFAULT 0,
    account_id TEXT
)');

// Table séquences personnalisées (cues) — aussi créée à la volée par sequences_db.php
$db->exec("CREATE TABLE sequences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_on TEXT NOT NULL DEFAULT '',  -- '' (manuel) | start | stop
    is_loop INTEGER NOT NULL DEFAULT 0,
    steps TEXT NOT NULL,                  -- JSON array
    position INTEGER NOT NULL DEFAULT 0,
    account_id TEXT
)");

echo "Base SQLite initialisée : $dbFile\n";
