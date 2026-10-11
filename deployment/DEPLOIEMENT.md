# Développer et livrer Foulée

Le kit réutilise le Dockerfile, Compose et backup.py de la release Debian
2026-10-11-preparation. Aucun tunnel Ollama ni modification Tailscale n'est ajouté.

## Sur M4

1. `bash deployment/test_local.sh` (NODE_BIN et PYTHON_BIN personnalisables).
2. `python3 deployment/run_local.py` : http://localhost:8875 ; base temporaire,
   indépendante des données personnelles. Le code d'accès est dans le chemin
   temporaire affiché, sous Library/Application Support/Foulee/access-code.txt.
   Ctrl+C arrête ce serveur et supprime les données de test.
3. Vérifier interface, import/export et PWA ; incrémenter CACHE_NAME dans sw.js
   lors d'une modification des fichiers publics. Un changement d'origine demande
   une nouvelle connexion et crée un stockage navigateur distinct.
4. Enregistrer un commit Git de la version validée.
5. `python3 deployment/prepare_release.py VERSION` produit une archive dans dist/
   avec sources, empreintes, référence Git et .env contenant un tag unique.
   Aucun transfert ni accès SSH n'est déclenché.

Les tests automatisés ne remplacent pas les essais iPhone/Watch. Pour une validation
Docker locale, extraire l'archive, puis lancer
`docker compose -f compose.yaml -f compose.local.yaml up --build --wait`.
L'override fourni utilise le port 8875 et le volume foulee-test-data.
Le M4 est ARM ; Compose cible explicitement amd64 comme Debian.

## Sur Debian — uniquement après validation explicite de la version

Transférer l'archive via scp (patrick@100.120.247.35, adresse Tailscale déjà connue),
vérifier son SHA256, puis extraire dans ~/foulee/releases/ sans écraser une release.
Dans le nouveau dossier : `bash deployer.sh --apply` valide les sources, construit
une nouvelle image et sauvegarde la base active. Il ne remplace pas le conteneur.
Copier la sauvegarde hors Debian et conserver aussi le code d'accès privé.
Ne pas communiquer le code dans le chat, un dépôt ou les journaux.
Après succès de cette copie, exécuter la commande Compose affichée par le script.
Contrôler /api/health, accès HTTPS Tailscale, données et synchronisation depuis
un deuxième appareil. Une interruption et une reconnexion sont normales.

Pas de migration initiale pour les mises à jour : le volume foulee-data est conservé.
Ne jamais employer down -v. Ne pas supprimer les anciennes images ni releases.
La sauvegarde native au premier changement du jour ne remplace pas une copie externe.
Le script refuse de reconstruire un tag existant.

## Retour arrière — après validation explicite

Dans le dossier de la précédente version, vérifier .env (pour la première release,
FOULEE_RELEASE=2026-10-11-preparation), puis `bash rollback.sh --apply`.
Si rollback.sh n'existe pas dans cet ancien dossier, employer directement :
`sudo docker compose up -d --no-build --pull never --wait --wait-timeout 120`.
Compose remplace le conteneur du même projet foulee en conservant les données.
Le retour arrière peut échouer avec les clients PWA ayant mis en cache une version
plus récente : vérifier la mise à jour et la synchronisation sur les appareils.
Vérifier la compatibilité du format des données avant de revenir à une ancienne image.
Une restauration SQLite nécessite arrêt du service et autorisation distincte :
elle remplace les données et peut perdre les changements postérieurs au snapshot.

## État initial

Une seule release et une seule image disponibles lors de l'inspection du 11 octobre
2026. Serve actif sur https://macmini-server.tail9ed71f.ts.net, vers 127.0.0.1:8765.
Le volume contient la base, le code privé et une sauvegarde native.
L'accès LLM depuis le conteneur vers Ollama M4 n'est pas configuré.
