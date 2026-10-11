# Foulée — Coach Running

MVP d'une application personnelle de coaching running, utilisable localement dans un navigateur sur Mac.

## Lancer l’application

Sur le Mac qui héberge les données, ouvre Terminal dans ce dossier puis lance `python3 manage_foulee_service.py install`. Si macOS autorise l’écriture dans `~/Library/LaunchAgents`, le serveur démarrera à l’ouverture de session et redémarrera automatiquement s’il s’arrête. Pour une session ponctuelle, `python3 serve_local.py` démarre le serveur au premier plan; `Ctrl+C` l’arrête.

### L’ouvrir sur un iPhone du même réseau

Le serveur écoute sur le réseau local au port `8765`. Sur chaque appareil du même réseau, ouvre `http://ADRESSE-IP-DU-MAC:8765/` dans un navigateur, puis saisis le code présent dans `~/Library/Application Support/Foulee/access-code.txt` sur le Mac. Pour connaître son adresse IP, consulte Réglages Système → Wi-Fi → Détails du réseau → Adresse IP. Le premier navigateur utilisé importe automatiquement ses anciennes données locales dans la base partagée.

Les données sont partagées entre les utilisateurs de cette installation : crée un profil par personne. La base SQLite se trouve dans `~/Library/Application Support/Foulee/foulee.sqlite3`; des sauvegardes quotidiennes sont conservées dans `~/Library/Application Support/Foulee/backups` (30 jours). Le code protège l’accès au serveur sur le réseau local. Il ne s’agit pas de comptes individuels : les personnes autorisées voient les profils partagés.

Pour arrêter le démarrage automatique : `python3 manage_foulee_service.py uninstall`. Cette commande conserve les données et les sauvegardes. `python3 manage_foulee_service.py status` affiche l’état du service.

## Installer Foulée comme application (PWA)

Ouvre Foulée dans un navigateur classique puis clique sur **Installer Foulée**. Chrome et Edge peuvent afficher leur dialogue d’installation. Dans Safari sur Mac, utilise **Fichier → Ajouter au Dock** si cette option est disponible. Le navigateur intégré de Codex ne propose pas forcément l’installation.

Sur iPhone, ouvre l’adresse du Mac dans Safari, puis **Partager → Sur l’écran d’accueil → Ouvrir comme app** (si proposé) → **Ajouter**. L’icône et le lancement dans une fenêtre dédiée sont configurés. Après une première connexion réussie et la préparation du cache, les profils, plans et exercices sont utilisables sans le Mac. Le serveur reste nécessaire pour la première connexion et la synchronisation entre appareils.

Le service worker fonctionne sur **localhost** sur le Mac, ou sur une adresse **HTTPS de confiance**. L’adresse `http://ADRESSE-IP-DU-MAC:8765` utilisée sur iPhone ne permet pas d’activer le service worker : il faudra configurer HTTPS pour le mode hors connexion. Le serveur prend maintenant en charge HTTPS local :

1. Lance `python3 setup_https.py Mac-mini-de-Patrick.local` (ajoute l’adresse IP comme second argument si tu l’utilises). Les clés privées restent dans `.https/`, exclu de Git et inaccessible via le serveur.
2. Transfère uniquement `.https/Foulee-Local.cer` par AirDrop sur l’iPhone. Installe le profil dans Réglages → Général → VPN et gestion de l’appareil, puis active **Foulee Local** dans Général → Informations → Réglages des certificats ([instructions Apple](https://support.apple.com/fr-fr/102390)). Cette autorité locale permet d’approuver les certificats signés par ce Mac; garde `ca.key` privé.
3. Redémarre le serveur (ou réinstalle le service avec `python3 manage_foulee_service.py install`). Il détecte automatiquement `.https/server.crt` et `.https/server.key`. HTTPS écoute sur le port 8766; HTTP reste disponible sur 8765 pour synchroniser les anciennes installations.
4. Ouvre `https://Mac-mini-de-Patrick.local:8766/` dans Safari sans avertissement de certificat, connecte-toi et attends **Application prête hors connexion**. Ajoute cette adresse à l’écran d’accueil, puis ouvre la nouvelle PWA une première fois avec le réseau et connecte-toi aussi dedans avant de tester le mode avion.

HTTP et HTTPS ont des stockages locaux distincts : synchronise les modifications en attente depuis l’ancienne adresse avant de changer. Les données du Mac sont conservées. Ne supprime pas l’ancienne icône tant que les données ne sont pas vérifiées. Le certificat serveur dure un an; relance le script et redémarre le serveur pour le renouveler, sans réinstaller l’autorité sur l’iPhone. Pour utiliser un certificat existant, définis `FOULEE_TLS_CERT` et `FOULEE_TLS_KEY`.

Hors connexion, l’application complète s’ouvre avec les données déjà récupérées sur cet appareil. Les modifications sont conservées dans IndexedDB, y compris les gros imports d’exercices, puis envoyées au Mac au retour de la connexion tant que l’application est ouverte. Après fermeture ou expiration de la session, utilise **Connecter au Mac** et saisis le code ; **Continuer hors connexion** permet de revenir aux données locales. Les appels API et les jetons ne sont jamais placés dans le cache du service worker. Les fonds de carte OpenStreetMap nécessitent Internet, mais les tracés restent disponibles.

Les modifications locales en attente sont envoyées avant de récupérer les données du serveur, pour éviter qu’un rafraîchissement les efface. Si deux appareils modifient la même donnée, la dernière écriture reçue par le Mac l’emporte. Ne supprime pas les données du navigateur avant la synchronisation ; un export du profil reste possible hors ligne.

Pour vérifier : ouvre l’adresse sécurisée, connecte-toi, attends l’installation du service worker puis recharge. Coupe le réseau (ou arrête le serveur), ferme et rouvre la PWA, consulte et modifie une séance. Rétablis la connexion, puis reconnecte-toi au Mac si nécessaire et vérifie la modification depuis un autre navigateur.

Les nouvelles versions du service worker proposent **Mettre à jour Foulée** : enregistre les modifications en cours avant de cliquer. Pour modifier les fichiers de l’application, incrémente `CACHE_NAME` dans `sw.js`. Le serveur force la revalidation des fichiers publics pour éviter une ancienne version persistante.

Références : [installation PWA (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [ajout sur l’écran d’accueil iPhone (Apple)](https://support.apple.com/fr-fr/guide/iphone/iphea86e5236/ios).

## Interface iPhone et PWA

L’interface utilise la police système Apple sur iPhone et Mac. Les formulaires et graphiques passent en une colonne sur petit écran; les champs restent lisibles et les commandes tactiles disposent d’une hauteur minimale de 44 à 48 px. La roadmap devient une liste de cartes sur mobile. Les imports, exports et le changement de profil sont accessibles dans **Options** dans l’en-tête. Le viewport et les marges tiennent compte des zones sûres de l’iPhone en mode PWA.

## Roadmap

La page **Fonctionnalités / Roadmap** est accessible depuis l’accueil et le choix du profil. Elle distingue les catégories **MVP** et **Analyse Expert** de l’état **✅ Terminé / 🚧 En cours ou à venir**. La priorité est de terminer la boucle de personnalisation et d’adaptation avant les outils experts. Les lignes sont maintenues dans `index.html` : à chaque fonctionnalité implémentée, mettre à jour son état, ses limites, le compteur et la date de mise à jour. Un export implémenté ne vaut pas validation sur Apple Watch réelle, qui dispose de sa propre ligne.

## Ce que fait ce MVP

- Affiche d’abord un écran d’entrée limité au choix d’une personne existante ou à la création d’un nouveau profil. Les fonctions de coaching ne s’ouvrent qu’après ce choix; **Changer d’utilisateur** revient à l’écran d’entrée.
- Propose une page dédiée au profil sportif : objectif, niveau, sorties par semaine, allure facile et distance habituelle de sortie longue.
- Permet de saisir un historique de courses (5 km, 10 km, semi-marathon, marathon, trail ou autre), avec date, distance si nécessaire, nom et temps; les résultats sont modifiables et supprimables.
- Génère une séance d’endurance, tempo, fractionné ou sortie longue à partir de modèles intégrés.
- Construit un calendrier hebdomadaire selon l’objectif (5 km, 10 km, semi, marathon), la date de départ, la date de course, le nombre de sorties, les jours de course préférés et le temps visé.
- Permet d’enregistrer plusieurs plans par profil, de les retrouver dans une bibliothèque, de consulter leur calendrier et de modifier leurs réglages. L’ancien plan est repris automatiquement lors de la migration.
- Estime les allures à partir du résultat le plus récent saisi dans l’historique; à défaut, signale que les repères calculés depuis le seul objectif sont provisoires.
- Permet de choisir une course de référence, affiche l’origine de l’estimation du seuil / tempo, permet de la corriger dans le profil ou depuis le plan, signale l’écart et recalcule le calendrier avec la valeur choisie.
- Affiche le détail des blocs de chaque séance; un éditeur dédié, en plein écran sur iPhone avec actions persistantes, permet de modifier échauffement, répétitions, travail, allure/effort, récupérations et retour au calme. La durée totale et la distance de travail sont calculées depuis ces éléments.
- Exporte les blocs d’une séance du plan au format JSON Foulée pour l’app compagnon iPhone, qui les convertit en séance WorkoutKit et peut la programmer dans l’app Exercice de l’Apple Watch.
- Permet plusieurs espaces sportifs indépendants sur un même navigateur. La page d’accueil permet de choisir le profil actif; chaque espace garde son profil, ses courses, son plan et sa séance. Le plan affiche le nom de la personne à laquelle il appartient.
- Exporte ou importe le dossier d’une personne en JSON pour le transférer entre appareils. À l’import, si le profil est déjà présent, l’application crée une copie distincte.
- Importe les résultats individuels Apple Watch : l’app compagnon iPhone permet de choisir un exercice dans Santé et exporte un fichier `foulee-results-v1` avec résumé, mesures, statistiques, événements et parcours GPS disponibles. Un rattachement optionnel à la séance importée permet à Foulée de mettre à jour sa durée et sa distance réelles.
- Propose un module **Exercices** indépendant des plans : import d’un exercice unitaire `foulee-results-v1`, bibliothèque par profil, traces GPS avec zoom + / −, pincement sur iPhone, déplacement et retour à la vue complète, et fond OpenStreetMap optionnel, rythme cardiaque, allure, pas par minute, altitude et pente en %. Les courbes fines permettent de consulter la mesure la plus proche au clic, au toucher ou avec les flèches du clavier; les allures les plus rapides sont affichées en haut. La sélection d’un instant synchronise tous les curseurs et le repère GPS. Les valeurs interpolées entre deux mesures sont signalées; aucune valeur n’est extrapolée en dehors des périodes couvertes, et le repère GPS disparaît lors des coupures de parcours. Les données détaillées sont normalisées avant leur stockage; le fichier original reste sur ton appareil. Les pas/min sont calculés sur les intervalles des mesures `stepCount`, l’allure depuis la vitesse, et D+/D− depuis les variations GPS (estimation sensible au bruit). La pente en % utilise la variation d’altitude sur les 100 derniers mètres horizontaux GPS : +5 % signifie une montée de 5 m pour 100 m. Elle est aussi disponible pour les exercices déjà importés. Les mesures absentes sont signalées. Aucun plafond de taille de fichier n’est imposé; au-delà de 100 Mo, une confirmation est demandée avant la lecture. Si le cache du navigateur est plein, les données d’exercice utilisent un cache en mémoire et sont enregistrées dans la base du Mac.
- Permet de modifier la date des séances, les marquer comme faites ou manquées, déplacer une séance manquée, puis noter la durée réellement effectuée.
- Permet de modifier les consignes et les durées, ajouter ou supprimer des étapes.
- Conserve chaque espace sportif séparément dans la base partagée SQLite du Mac; les changements sont synchronisés entre navigateurs connectés.
- Exporte la séance en JSON.

Les profils, résultats et plans sont partagés par les appareils connectés au serveur local et protégés par un code d’accès. Le jeton de connexion reste dans la session du navigateur. Les changements sont synchronisés automatiquement; si deux appareils modifient la même donnée en même temps, la dernière écriture enregistrée prévaut. Le détail des changements est dans `CHANGELOG.md`. Les modèles de séance sont des repères généraux, pas un programme médical ni un plan d’entraînement individualisé par IA.

## Fichiers

- `index.html` — structure de l’application, avec accueil et page dédiée au profil
- `styles.css` — interface responsive
- `app-v2.js` — script chargé par la page : modèles, profil, historique, édition, suivi et export vers le compagnon
- `exercise-module.js` — import, normalisation et visualisation des exercices unitaires
- `app.js` — copie de compatibilité du script applicatif
- `serve_local.py` — serveur local, API de synchronisation, authentification et stockage SQLite
- `manage_foulee_service.py` — installation, état et retrait du lancement automatique macOS
- `AppleWatchCompanion/FouleeWatchCompanion.xcodeproj` — projet iOS natif compagnon

## Limites actuelles

- Les séances sont créées à partir de modèles, sans appel à une IA.
- L’export Apple Watch passe par l’app compagnon iPhone; le navigateur seul ne peut pas appeler WorkoutKit.
- Le compagnon compile pour iOS et le simulateur. Pour le lancer sur un iPhone, il faut ouvrir le projet dans Xcode, sélectionner une équipe de signature et disposer d’un iPhone jumelé à une Apple Watch pour vérifier la synchronisation réelle.
- Le serveur doit tourner sur le Mac hôte pour que les autres appareils puissent consulter et modifier les données.

## Feedback des exercices importés

Dans **Exercices**, le panneau **Feedback et progression** permet de saisir le ressenti, le RPE (1 à 10), un commentaire et d’associer l’activité à une séance d’un plan du profil. Les données sont conservées lors d’un réimport du même exercice. La comparaison porte actuellement sur la durée : tolérance initiale de ±15 %, seuil RPE de 8/10, ou ressenti difficile. Ces critères sont réglables par exercice et constituent des seuils de travail à valider, pas des recommandations médicales. En cas de signal, l’utilisateur peut conserver son plan ou ouvrir le plan associé pour le modifier. Aucune modification automatique n’est effectuée.

Le bilan des mesures est local et déterministe. Une lecture complémentaire par un LLM local est disponible sur demande (configuration ci-dessous). Le moteur d’interprétation compare la durée totale, la durée des blocs explicitement associés et leur allure moyenne de travail lorsque la consigne est au format `5:30/km`. Les tolérances de durée et d’allure et le seuil RPE sont réglables. Il distingue les écarts des données non évaluables; les associations absentes ou ambiguës ne produisent pas de conclusion. Un changement de séance associée ou un réimport efface les associations de phases pour éviter une comparaison incorrecte. La proposition de changements chiffrés reste à implémenter. Une durée conforme ne suffit pas à conclure que toute la séance est conforme.

### Phases importées

Si le JSON contient `healthKit.activities`, l’import conserve les phases valides avec leur début, leur fin, leur durée, leur distance (si disponible) et l’identifiant d’étape. Le résultat affiche chaque phase et son allure calculée depuis la durée et la distance. Les noms restent ceux du fichier ou « Phase N » : les rôles échauffement/récupération et les objectifs ne sont pas inventés.

Active **Afficher les phases sur les graphiques et le parcours GPS** pour afficher des bandes numérotées sur les courbes et des portions de parcours de la même couleur. Les limites GPS sont interpolées seulement entre points espacés de 120 secondes au maximum, sans relier les traces séparées. Les exercices déjà importés doivent être réimportés pour récupérer leurs phases; le feedback est conservé.

### Interface selon l’appareil

Sur un téléphone tactile, Foulée installée sur l’écran d’accueil affiche les options du profil dans un panneau en bas de l’écran, avec de grandes actions et un bouton Fermer. Sur ordinateur (y compris la PWA Mac), les options restent dans un menu déroulant ancré au bouton. Le menu se ferme après une action, au clic extérieur ou avec Échap. Le navigateur mobile conserve son interface responsive habituelle.


## Lecture de séance par un LLM local

Dans **Exercices → Feedback et progression**, enregistre le ressenti et les associations de phases, puis utilise **Connecter au LLM du Mac**, sélectionne un modèle déjà installé et clique sur **Demander une lecture**. Le serveur Foulée communique avec le LLM sur le Mac; l’iPhone utilise cette même connexion par le serveur Foulée. Aucun modèle n’est téléchargé par l’application.

Ollama est le réglage initial, à `http://127.0.0.1:11434`. Démarre son serveur local et installe un modèle compatible avec les sorties JSON structurées. Pour LM Studio, démarre son serveur dans l’onglet Developer et charge un modèle compatible JSON, puis lance Foulée avec :

```sh
FOULEE_LLM_PROVIDER=lmstudio python3 serve_local.py
```

LM Studio utilise par défaut `http://127.0.0.1:1234`. Un port personnalisé se configure avec `FOULEE_LLM_URL=http://127.0.0.1:PORT`; seules les origines HTTP sur une adresse IP de boucle locale sont acceptées. `FOULEE_LLM_MODEL` définit le modèle présélectionné. Si le serveur LLM exige un jeton, utilise `FOULEE_LLM_API_KEY` sur le Mac; il n’est pas transmis au navigateur.

Pour conserver LM Studio au démarrage automatique :

```sh
FOULEE_LLM_PROVIDER=lmstudio python3 manage_foulee_service.py install
```

Le service conserve les variables LLM configurées lors des réinstallations; les variables fournies à la commande remplacent les précédentes. Le LLM doit lui aussi être démarré. Redémarre le serveur Foulée après les changements du code serveur.

Le contexte transmis contient les constats des critères mesurés (direction et ampleur par rapport à la tolérance), les éléments non évalués, le ressenti/commentaire enregistré et l’intention de la séance (nom, consigne, objectif et niveau du profil). Les numéros des blocs et les commentaires sont conservés pour ne pas perdre leur sens. Ni le parcours GPS, ni les séries complètes, ni le nom du profil ne sont envoyés. Les modèles Ollama identifiés comme distants sont exclus de la liste. Aucun repli vers un service externe n’est prévu.

La réponse comprend un résumé, des observations avec références aux mesures, des limites et des pistes à examiner. Son format et les références sont vérifiés, mais la justesse du texte doit être appréciée en regard des mesures. Le LLM ne modifie aucun plan. La lecture est enregistrée avec l’exercice et reste consultable hors connexion; elle devient obsolète lorsque son contexte change. Une seule génération est autorisée à la fois sur le Mac; le délai serveur est de 120 secondes. Une erreur de connexion ou une réponse invalide conserve le bilan du moteur et la précédente lecture.

Contrats API : [Ollama Chat](https://docs.ollama.com/api/chat), [Ollama modèles](https://docs.ollama.com/api/tags), [sorties structurées LM Studio](https://lmstudio.ai/docs/developer/openai-compat/structured-output).


### Installation retenue sur ce Mac

Ollama est installé dans `/Applications/Ollama.app`. Le service `com.foulee.ollama` le lance à l’ouverture de session avec `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_NO_CLOUD=1`, un contexte de 8192 tokens et une seule génération simultanée. Il utilise les modèles dans `~/.ollama/models`; ses journaux sont dans `~/Library/Application Support/Foulee/ollama.log` et `ollama-error.log`.

Le modèle choisi pour le premier essai sur le Mac M4 à 16 Go est `qwen3:8b` (environ 5,2 Go téléchargés). Foulée désactive son mode de réflexion pour garder les lectures JSON brèves et réduire le délai. Les textes générés sont qualitatifs : les chiffres restent affichés par le moteur, et le contrôle serveur refuse les chiffres dans la narration. Le LLM reçoit les constats qualitatifs des critères (dans ou hors tolérance, supérieur ou inférieur au prévu), sans les valeurs à recalculer. Le service Foulée présélectionne ce modèle. Le temps et la qualité d’une lecture varient avec le contenu et les autres applications ouvertes.

Pour consulter les modèles ou l’utilisation GPU :

```sh
/Applications/Ollama.app/Contents/Resources/ollama list
/Applications/Ollama.app/Contents/Resources/ollama ps
```

Le service local Foulée démarre Ollama sans lancer son interface graphique; évite de lancer simultanément un second serveur Ollama sur le même port.

Le menu **Options** est disponible aussi avant le choix du profil. Il regroupe **Roadmap** et **Options graphiques → Mode sombre**. Le thème est mémorisé localement sur chaque appareil. Dans la PWA, une roue crantée remplace le texte Options.

Validation réalisée via l’API authentifiée de Foulée avec une séance fictive : lecture qualitative JSON en français reçue en 13,7 secondes à chaud. Aucun exercice utilisateur n’a été modifié pour ce test.

### Fonds de carte des exercices

Sous le parcours GPS, **Fond de carte** permet de choisir **Épuré (Positron)**, **Détaillé (Bright)**, **Classique (Liberty)**, **Sombre (Dark)** ou **Bleuté (Fiord)** via OpenFreeMap. L’ancien fond OpenStreetMap et **Sans fond · hors connexion** restent disponibles. Le choix est mémorisé sur l’appareil. Les fonds nécessitent Internet; le tracé GPS, les phases et le curseur synchronisé restent utilisables sans fond. MapLibre est chargé à la demande depuis unpkg, puis les styles et tuiles depuis OpenFreeMap; aucune clé API n’est nécessaire. Le parcours et les mesures ne sont pas envoyés au fournisseur, qui reçoit les requêtes des zones cartographiques affichées.


### Lecture contextualisée (méthode de coaching version 2)

Le modèle connaît désormais la séance prévue, sa consigne, l’objectif et le niveau sportifs du profil. Le serveur distingue les écarts proches de la tolérance de ceux qui atteignent au moins le double de celle-ci. Pour une allure exprimée en secondes/km, il indique explicitement si le coureur est plus rapide ou plus lent. Cette classification exprime un écart aux réglages, pas une gravité physiologique.

Le coaching doit relier la réalisation au ressenti et à l’intention : un footing trop rapide et difficile appelle une vérification de l’aisance; des allures tenues en séance soutenue avec effort élevé appellent une question sur les récupérations et le caractère habituel de la difficulté. Ces pistes restent conditionnelles et ne modifient pas le plan. La fréquence cardiaque et les tendances historiques ne sont pas analysées dans ce contexte; aucune progression ou adéquation de charge ne peut être établie sur cette seule lecture. Cette version reste un modèle local compact : une réponse structurée n’est pas une garantie de jugement pertinent.

Les anciennes lectures sont conservées mais signalées comme obsolètes lorsque la méthode ou le contexte change. Utilise **Demander une lecture** pour bénéficier de la nouvelle méthode après la mise à jour de Foulée.

Dans la PWA mobile, la carte est agrandie (environ la moitié de l’écran) et le zoom s’effectue au pincement, sans boutons + / −. **Calques**, en haut à droite de la carte, ouvre le sélecteur natif des fonds; **Voir tout le parcours** recentre la vue. Sur ordinateur, les boutons de zoom restent disponibles.

### Connexion et mise à jour

**Vérifier les mises à jour** reste accessible dans le bandeau d’installation. Lorsqu’une nouvelle version s’active, **Mettre à jour Foulée** recharge l’interface après enregistrement des modifications. Une vérification est aussi lancée au retour dans l’application. Si le Mac ne répond pas, la connexion se termine par un message après 12 secondes; les envois de données volumineux disposent de 60 secondes. La reconnexion réapparaît dans Options après une erreur, et les modifications en attente restent conservées localement.

### Organiser le détail d’un exercice

**Renommer**, dans l’en-tête de l’exercice, permet d’enregistrer un nom personnalisé (120 caractères maximum), conservé lors d’une réimportation. Le détail est séparé en quatre onglets sur mobile et ordinateur : **Ressenti**, **Dialogue LLM** (lecture locale existante), **Graphiques**, **Attendu / réalisé**. Le ressenti et l’association / les critères s’enregistrent séparément. Un brouillon reste disponible quand on change d’onglet ou quand on enregistre l’autre formulaire pendant la session; enregistre-le avant de fermer ou recharger l’app. Les graphiques proposent une courbe à la fois ou toutes les courbes, en conservant le curseur commun et la carte.

### Dialogue de suivi par séance

Après la lecture initiale, le champ **Poursuivre l’échange** permet de poser une question ou d’apporter une précision. Des suggestions amorcent la discussion. Le suivi utilise le modèle de la lecture initiale et transmet l’historique complet avec le contexte qualitatif de la séance. Le ressenti enregistré et les plans ne sont pas modifiés.

Les conversations, leurs dates, le modèle et le contexte initial sont enregistrés avec l’exercice; le brouillon est sauvegardé pendant la saisie. Une nouvelle lecture conserve la conversation précédente. Si les données changent, les anciennes conversations restent consultables sous **Contexte antérieur** et une nouvelle lecture est nécessaire. Les lectures déjà enregistrées sont reprises dans cette présentation. Les échanges restent consultables hors connexion; répondre nécessite le LLM du Mac. Une conversation accepte vingt questions de suivi, avec un maximum de deux mille caractères par message, puis une nouvelle lecture permet de poursuivre. Une erreur conserve le dialogue et le brouillon.

## Développement M4 et déploiement Debian

Le serveur Debian utilise désormais Docker Compose et Tailscale Serve.
Le lancement automatique Foulée sur le M4 est désactivé ; il reste possible de
lancer une session de développement avec données temporaires :
`python3 deployment/run_local.py` (http://localhost:8875).
Voir [la procédure de livraison et retour arrière](deployment/DEPLOIEMENT.md).
Chaque transfert, déploiement et retour arrière sur Debian attend une validation
explicite de la version concernée.
