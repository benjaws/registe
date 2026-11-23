# Registe

## Protection par mot de passe

Le projet est protégé par un fichier `.htaccess` utilisant l'authentification Basic.

Identifiants par défaut :

- utilisateur : `admin`
- mot de passe : `changeme`

Pour changer le mot de passe :

```bash
htpasswd -bc .htpasswd admin nouveau_mot_de_passe
```
