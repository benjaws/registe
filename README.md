# Régiste

**La régie tout-en-un pour les spectacles d'improvisation — depuis le navigateur.**

Régiste réunit dans une seule interface toute la technique d'un match/spectacle d'impro :
chronomètre synchronisé sur une tablette côté scène, contrôle des lumières DMX,
musique (locale ou Spotify), tirage des catégories et génération de thèmes. Pensé pour
les petites compagnies, il fonctionne en multi-comptes : chaque compagnie a ses propres
données.

> Un produit conçu et utilisé par le [Studio Sous-Gare](https://studio-sous-gare.ch),
> créé par [Benjamin Boury-Jamot](https://studio-sous-gare.ch/benjamin-boury-jamot.html).

---

## Fonctionnalités

- **⏱️ Chrono synchronisé** — un écran plein écran (`chrono.php`) à ouvrir sur une tablette
  côté scène, parfaitement synchro avec la régie. Couleurs d'alerte sur les dernières
  secondes. Depuis la tablette on peut aussi déclencher « Fin d'impro » et « Couper le son »
  (avec fondu) sur la page principale.
- **💡 Lumières DMX** — pilotage de projecteurs directement depuis le navigateur via l'**API
  Web Serial** et une interface **Enttec DMX USB PRO**. Palette de couleurs par projecteur ou
  pour tous, slider d'intensité, bouton « Noir complet », et séquence de fin d'impro
  (noir immédiat puis retour au blanc chaud). Types de projecteurs gérés : `RGB`, `RGBW`,
  `RGB_DIM`, `DIM_RGB`, `RGBW_DIM`, `DIM_RGBW`.
- **🎵 Musique** — lecteur de musiques de transition, et intégration **Spotify** optionnelle
  (OAuth + Web Playback SDK) pour piloter ta playlist.
- **🎲 Catégories & thèmes** — tirage des catégories d'impro (avec durées), génération
  automatique de thèmes (optionnelle, activable par catégorie) et historique de la soirée.
- **👥 Multi-comptes** — page d'accueil publique, inscription des compagnies *sur validation*,
  interface super-admin pour activer/suspendre les comptes. Chaque compagnie ne voit que
  ses catégories, musiques et projecteurs.

---

## Pile technique

- **PHP 8** + **SQLite3** (base unique `data/impro.sqlite`)
- **Apache** avec `.htaccess`
- **Bootstrap 5.3** + CSS maison (`app.css`), police Inter
- **Web Serial API** (Chrome/Edge uniquement) pour le DMX
- Spotify Web Playback SDK (optionnel)

Aucune étape de build : ce sont des fichiers PHP/JS/CSS servis directement.

---

## Prérequis

- PHP 8+ avec l'extension **SQLite3**
- Apache (ou tout serveur PHP ; `.htaccess` recommandé en production)
- Pour le DMX : **Google Chrome** ou **Microsoft Edge** (Web Serial), et une interface
  **Enttec DMX USB PRO** branchée sur le PC qui pilote la régie
- Pour Spotify (optionnel) : un compte **Spotify Premium** et une app sur
  [developer.spotify.com](https://developer.spotify.com/dashboard)

---

## Installation

```bash
git clone git@github.com:benjaws/registe.git
cd registe

# 1) Initialiser la base SQLite (crée les tables)
php data/init_sqlite.php

# 2) Créer le premier compte super-admin (adapte e-mail / mot de passe / compagnie)
php -r '
$db = new SQLite3("data/impro.sqlite");
$st = $db->prepare("INSERT INTO accounts (id,company,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)");
$st->bindValue(1, uniqid("acc_"));
$st->bindValue(2, "Ma Compagnie");
$st->bindValue(3, "admin@exemple.ch");
$st->bindValue(4, password_hash("change-moi", PASSWORD_DEFAULT));
$st->bindValue(5, "superadmin");
$st->bindValue(6, "active");
$st->bindValue(7, date("c"));
$st->execute();
echo "Super-admin créé.\n";
'
```

Puis sers le dossier avec Apache (voir [Déploiement](#déploiement)) ou, pour tester vite :

```bash
php -S localhost:8000
```

Et ouvre <http://localhost:8000>.

---

## Configuration

### Clé pour la génération de thèmes (optionnel)

La génération automatique de thèmes (`get_theme.php`) nécessite une API de LLM. Copie
`.env.example` en `.env` et renseigne la clé :

```bash
cp .env.example .env
```

```dotenv
OPENAI_API_KEY=...
```

> ⚠️ Le fichier `.env` **ne doit jamais être commité ni servi publiquement** (il est
> dans `.gitignore` et bloqué par `.htaccess`). Sans clé, l'app fonctionne normalement —
> seule la génération de thèmes est désactivée.
>
> 🔁 *Migration prévue vers l'API Claude/Anthropic* (abandon d'OpenAI).

### Spotify (optionnel)

La première ouverture de `spotify.php` demande ton **Client ID** Spotify. Dans le dashboard
Spotify, ajoute l'URL de redirection de ton installation (ex. `https://registe.ch/spotify.php`)
et ton e-mail dans *User Management* si l'app est en mode développement.
Une fois connecté, tu reviens automatiquement à la régie : le lecteur Spotify est intégré
dans la carte « Musique » (onglet **Spotify**).

---

## Utilisation

### 1. Première configuration (côté admin)

Connecte-toi, puis va dans **⚙️ Admin** pour :

- déclarer tes **projecteurs** (nom, adresse DMX, type) ;
- créer tes **catégories** d'impro (type, description, durées, génération de thème on/off) ;
- ajouter tes **musiques** de transition.

### 2. Pendant le spectacle (la régie — `regie.php`)

- Choisis une catégorie → la durée et le thème s'affichent.
- **Jouer / Stopper** le chrono. « Stopper » déclenche la séquence lumière de fin d'impro.
- Colonne **Lumières (DMX)** : clique **🔌 Connecter** (choisis le port série de l'Enttec),
  puis joue avec les couleurs, l'intensité, « Base (blanc chaud) » et « Noir complet ».
- Carte **Musique** : onglet **Local** (tes mp3) ou **Spotify** (playlists, titres likés,
  recherche et mini-lecteur). Un mp3 local qui démarre met Spotify en pause.
- Carte **🎬 Séquences** (sous les lumières) : tes enchaînements programmés dans
  *Admin → Séquences*. Étapes possibles : couleur et intensité (avec fondu, éventuellement en
  parallèle), noir / rallumer, mp3 local, couper le son, Spotify (lecture, pause, suivant ou
  lien d'un titre/playlist), Jouer / Stopper, attente, « attendre GO ». Une séquence peut tourner
  en boucle, ou se déclencher automatiquement au « Jouer » ou au « Stopper » (elle remplace
  alors le noir 3 s → blanc chaud de fin d'impro). « Stopper » arrête toujours la séquence en cours.
- **Raccourcis clavier** : `V` valider, `J` jouer, `S` stopper, `Espace` lecture/pause musique,
  `←/→` titre précédent/suivant, `↑/↓` volume, `M` fondu musique, `T` Local↔Spotify,
  `/` recherche Spotify, `B` base lumière, `N` noir complet, `1`–`9` séquences, `G` GO,
  `Échap` arrêter la séquence, `?` aide.

### Dock Mirabox (boutons physiques)

Un **Mirabox 293S** (15 touches écran + 3 boutons) se branche en USB sur le PC de régie et
pilote Régiste via **WebHID** (Chrome/Edge). Bouton **🎛️ Dock** dans la régie :

- **🔌 Connecter le dock** (une seule fois : Chrome s'en souvient et reconnecte tout seul) ;
- clique une touche de l'aperçu puis choisis son action : Valider / Jouer / Stopper, musique
  (lecture, suivant, volume, fondu, Local↔Spotify, un mp3 précis), lumières (base, noir,
  intensité ±, une couleur pour tous ou pour un projecteur), séquences (par nom ou par position),
  GO et arrêt de séquence ;
- **Enregistrer** : la disposition est gardée par compte.

Les touches affichent l'état en direct : chrono sur « Jouer », séquence en cours encadrée,
« GO » qui clignote quand une séquence l'attend, touches lumière grisées sans DMX.
Si les images apparaissent de travers, change **Rotation des images**.
Sous Linux, autorise l'accès au dock :
`echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="5548", MODE="0666"' | sudo tee /etc/udev/rules.d/99-mirabox.rules`
puis débranche/rebranche. Ferme le logiciel Mirabox officiel (il garde le dock pour lui).

### 3. L'écran tablette (`chrono.php`)

Ouvre `chrono.php` sur une tablette côté scène (bouton **⏱️ Chrono (écran)** dans la régie).
Il affiche le chrono en grand, synchronisé avec la régie, et permet de déclencher
**Fin d'impro** et **Couper le son** à distance.

### 4. Comptes & validation (`superadmin.php`)

Les compagnies créent un compte via **Créer un compte** (statut *en attente*). Un super-admin
les **active** depuis l'interface super-admin. Chacun change son mot de passe via **👤 Mon compte**.

---

## Déploiement (Apache)

Exemple de vhost (HTTPS via Let's Encrypt) servant le dossier :

```apache
<VirtualHost *:443>
    ServerName registe.ch
    DocumentRoot /var/www/html/registe
    <Directory /var/www/html/registe>
        AllowOverride All
        Require all granted
    </Directory>
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/registe.ch/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/registe.ch/privkey.pem
</VirtualHost>
```

Le `.htaccess` fourni bloque l'accès web aux fichiers sensibles (`.env`, `.htpasswd`,
`*.sqlite`, sauvegardes…). **Sers toujours l'app en HTTPS** (sessions, Web Serial, Spotify
l'exigent).

---

## Sécurité — à retenir

- Ne **jamais** committer de secret : `.env`, `.htpasswd` et la base `*.sqlite` sont ignorés par git.
- La base `data/impro.sqlite` contient des e-mails et des hash de mots de passe : ne la publie pas.
- Les musiques (`music/*.mp3`) sont ignorées par git (droits d'auteur) et restent sur le serveur.

---

## Roadmap

Les grands chantiers à venir (par ordre d'envie, pas forcément de priorité) :

- [ ] **LLM multi-fournisseurs (dont Ollama)** — rendre la génération de thèmes agnostique :
  pouvoir brancher au choix Claude/Anthropic, un **modèle local via [Ollama](https://ollama.com)**
  (hors-ligne, sans clé ni coût), etc. Abandon d'OpenAI.
- [ ] **Sortir de PHP pour profiter du temps réel** — réécrire en stack JS/TS
  (Nuxt / SvelteKit + Supabase, ou Node + socket.io) pour une synchro **WebSocket** du chrono,
  de l'état DMX et des commandes, au lieu du polling actuel. Migration en v2, sans casser l'existant.
- [x] **Séquences personnalisées (cues)** — enchaîner lumière, son et chrono, à la volée
  (bouton / touches `1`–`9`) ou automatiquement au « Jouer » / « Stopper ».
- [ ] **Conducteur de spectacle** — enchaîner les séquences dans l'ordre de la soirée (cue list avec GO global).

### Idées en vrac (à trier plus tard)

- [ ] **Presets / scènes lumière** enregistrables et rappelables en un clic.
- [ ] **Feuille de match** : équipes, joueurs, score, fautes, vote du public.
- [ ] **Mode PWA / hors-ligne** (le wifi des salles est souvent mauvais).
- [x] **Raccourcis clavier** (bouton ⌨️ ou touche `?` dans la régie)
- [ ] **Pédale / boîtier MIDI/USB** pour piloter sans souris pendant le spectacle.
- [ ] **Export de la soirée** (PDF/CSV : catégories jouées, thèmes, durées).
- [ ] **Bibliothèque de musiques** mieux rangée (playlists, tags) côté local.
- [ ] **Thème clair/sombre** et **multi-langue**.

> Envie de contribuer ou de suggérer une idée ? Ouvre une *issue* sur le dépôt.

---

## Licence

Sous licence **MIT** — libre d'utilisation, de modification et de redistribution.
Voir le fichier [LICENSE](LICENSE).

Créé par Benjamin Boury-Jamot / [Studio Sous-Gare](https://studio-sous-gare.ch).
