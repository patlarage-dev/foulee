## 2026-10-05 — Profil en lecture et trophées

- Mon profil sportif affiche nom, objectif principal et expérience ; mise à jour sur une page dédiée conservant tous les champs.
- Courses présentées sous forme de cartes trophées avec titre, type, date, temps et actions Modifier/Supprimer.
- Ajout et modification des résultats sur une page dédiée avec retour au profil après enregistrement.
- Vérifications mobile/ordinateur et enregistrement sans duplication ; cache PWA v54.

## 2026-10-05 — Résumé du plan actif simplifié

- Suppression des minutes saisies et prévues ; compteur des séances réalisées conservé. Cache PWA v51.

## 2026-10-05 — Actions en haut de la visualisation

- Boutons « Mettre à jour » et « Exporter » placés à côté du titre de la séance.
- Suppression du retour au plan en bas ; lien supérieur conservé. Cache PWA v50.

## 2026-10-05 — Durée ou mètres pour chaque phase

- Pictogrammes chronomètre et règle pour choisir durée + allure ou mètres + allure dans l’exercice libre et l’éditeur des séances.
- Champs séparés minutes et secondes pour la durée et l’allure au kilomètre.
- Durée calculée depuis les mètres et l’allure lors de l’export, répétitions comprises. Cache PWA v49.

## 2026-10-05 — Édition des séances et répétitions

- Titre, type et noms des phases fixes ; modification des allures, distances et date.
- Ajout, suppression et déplacement des phases ; blocs de répétition pour VMA et Tempo avec regroupage et dégroupage.
- Présentation des répétitions pour les nouveaux plans et migration des séances non effectuées des plans existants au chargement, sans modifier les résultats associés.
- Durée dérivée de la distance et de l’allure ; récupération finale d’origine conservée. Cache PWA v48.

## 2026-10-05 — Éditeur de plan réorganisé

- Titre, cases illustrées Course/Maintien en forme, dates, temps visé obligatoire puis jours habituels.
- Nombre de séances calculé depuis les jours cochés (2 à 5), carrés adaptés à la largeur mobile.
- Repères d’allure dans un sous-menu, saisie minutes et secondes au kilomètre avec conversion dynamique en km/h.
- Vérification visuelle à 390 et 1200 px, conversion 6:30/km → 9,23 km/h ; cache PWA v47.

## 2026-10-05 — Visualisation depuis le calendrier

- Un clic sur une séance prévue ouvre sa visualisation, y compris depuis le choix des séances d’un même jour.
- Cache PWA v46.

## 2026-10-05 — Mise à jour depuis la visualisation

- Bouton « Mettre à jour » dans la visualisation d’une séance prévue, ouvrant son éditeur.
- Les séances effectuées restent dirigées vers leur exercice lié et protégées contre l’édition.
- Cache PWA v45.

## 2026-10-05 — Protection du plan actif et dates

- Activation possible uniquement après désactivation du plan actif, avec confirmation.
- Suppression du plan actif bloquée dans la carte et dans la logique de suppression.
- Type Course ou Autre plan dans l’éditeur ; date de la course ou date de fin affichée sur les cartes.
- Les autres plans se terminent sans séance de course ; cache PWA v42.

## 2026-10-05 — Visualisation de l’exercice lié

- Visualiser une séance effectuée ouvre directement l’exercice enregistré qui lui est associé.
- Mention « Lecture seule » retirée de la visualisation des séances prévues.
- Cache PWA v44.

## 2026-10-05 — Séances effectuées en lecture seule

- Bouton d’édition retiré des séances effectuées ; ouverture de l’éditeur redirigée vers la visualisation.
- Enregistrement bloqué si un résultat a été associé pendant l’édition.
- Cache PWA v43.

## 2026-10-05 — Visualisation des séances

- Bouton Visualiser ouvrant une page de séance en lecture seule, avec phases et totaux.
- Suppression du détail dépliable dans les cartes ; icône de réglages pour l’édition.
- Cache PWA v42.

## 2026-10-05 — Cartes compactes et éditeur de plans

- Titre libre conservé par plan ; objectif, temps facultatif et séances réalisées sur la carte.
- Actions à droite : Actif/Inactif, Modifier et Supprimer en rouge.
- Création et modification sur une page dédiée avec retour à la bibliothèque ; suppression des repères 01 et 02.
- Allures calculées depuis le profil ou une course de référence lorsque le temps visé est absent ; cache PWA v41.

## 2026-10-05 — Cartes compactes dans Plan

- Date prévue mise en évidence à gauche, titre et totaux au centre, export et édition à droite.
- Icône accessible indiquant les séances effectuées ou à faire ; phases dépliables et actions compactes sur mobile.
- Allure moyenne calculée sur toutes les phases et cache PWA v41.

## 2026-10-05 — Accès aux plans depuis les paramètres

- Entrée de menu « Plans enregistrés » avec chevron ; liste et création accessibles sur leur page dédiée, avec retour aux paramètres.
- Styles de la bibliothèque appliqués à la page dédiée et cache PWA v40 pour diffuser cette présentation.

## 2026-10-04 — Blocs de répétition dans l’exercice libre

- Bouton Répétition : sélection de phases consécutives et nombre de tours (2 à 100).
- Plusieurs blocs indépendants, avec phases éditables, déplacement et dégroupage.
- Export dans l’ordre exact : chaque tour inclut toutes ses phases, récupération comprise.
- Conversion des anciennes durées « N × durée » en blocs visibles.
- Cache PWA v39 ; tests du scénario ×4, pause, ×5 et des durées exportées.

## 2026-10-04 — Date et export des exercices libres

- Date prévue modifiable et conservée par profil pour l’exercice libre.
- Export libre compatible avec le décodeur iPhone et les phases WorkoutKit.
- Répétitions alternées avec récupération, secondes et minutes décimales incluses dans le total.
- Aperçu iPhone des phases réelles et validation de leur durée totale.
- Cache PWA v38 ; 40 tests JavaScript réussis.

# Changelog

## 2026-10-04 — Gestion des plans depuis une page dédiée

- Paramètres affiche un accès « Plans enregistrés »; bibliothèque et éditeur déplacés sur cette page.
- Actions explicites pour modifier, supprimer, activer et retirer le plan actif; un espace peut rester sans plan actif.
- Édition limitée aux allures, seuil, course, fréquence et jours des séances, dates et temps visé. Les allures modifiées sont propres au plan.
- Vérification du parcours et de l’enregistrement sans activation; test de persistance de l’absence de plan actif.

## 2026-10-04 — Consultation du plan et édition des séances

- Plan actif en lecture seule : type, date, durée et distance, phases repliées, export et édition avec icônes; suppression du numéro 03 et des statuts manuels.
- Réglages du plan actif et repères d’allure accessibles dans Paramètres.
- Page dédiée pour modifier les séances et ajouter, supprimer ou renommer leurs phases; durées et distances recalculées à chaque saisie.
- Statut « Faite » uniquement lorsqu’un exercice importé est explicitement associé; phases personnalisées conservées dans l’export et utilisées dans la comparaison.
- Tests JavaScript et vérification du modèle Swift pour l’export Watch.

## 2026-10-04 — Calendrier compact et plan actif

- Cases réduites sur téléphone (52 px) et ordinateur (76 px); largeur du calendrier limitée à 950 px.
- Séances à venir du plan actif ajoutées au calendrier sans point; les exercices importés réalisés conservent leurs points.
- Plans enregistrés et formulaire de création/modification déplacés dans Paramètres. L’onglet Plan montre uniquement le plan actif.
- Modifier ou préparer un autre plan ne l’active pas; le premier plan devient actif et les autres s’activent depuis la bibliothèque.
- Tests de filtrage des séances, exclusion des doublons associés et édition sans activation; validation mobile du changement de plan actif.

## 2026-10-04 — Types, calendrier coloré et exercice libre

- Quatre types : footing bleu, sortie longue verte, tempo orange, VMA rouge; choix obligatoire à l’import et modification du type avec le nom.
- Calendrier sans noms, jours colorés et points; choix de l’exercice lorsqu’un jour en contient plusieurs. Légende et explication dans le bouton information.
- Pastille rouge sur Paramètres quand une mise à jour PWA est prête.
- Exercice libre allégé : profil, gestion des plans et numéro 02 retirés, choix du type par boutons colorés.
- Correction de la génération des sorties longues continues avec une distance de profil renseignée.

## 2026-10-04 — Navigation et calendrier des exercices

- Quatre destinations avec icônes : Calendrier, Plan, Exercice libre et Paramètres. Barre fixe en bas sur téléphone, barre horizontale sur ordinateur.
- Grand calendrier mensuel des exercices enregistrés, plusieurs exercices par date, navigation entre les mois et retour au mois courant.
- Ouverture directe de l’exercice choisi et flèche de retour conservant le mois consulté.
- Paramètres regroupant apparence, profil, imports/exports, roadmap, connexion au Mac et mises à jour PWA.
- Calendrier isolé par profil et dates locales; accès et fonctionnement hors connexion conservés.

## 2026-10-04 — Jauges attendu / réalisé et séances continues

- Comparaison visuelle par étape : durée, allure des blocs de travail, repère de l’attendu et valeurs réalisées.
- Critères et tolérances retirés de l’interface; associations de séance et de phases par boutons.
- Réalisé indisponible explicite quand une phase manque ou que son association est ambiguë.
- Footings et sorties longues générés en un bloc continu; anciens blocs automatiques 5 + travail + 5 regroupés à durée identique. Structures marquées comme modifiées conservées.
- Échauffement et retour au calme conservés pour les séances de qualité.

## 2026-10-04 — Échelles visuelles et données superposées

- Sensations facultatives en trois boutons illustrés, distinctes de l’intensité RPE.
- RPE de 1 à 10 sur une échelle colorée, effaçable et utilisable au clavier.
- « Données » : boutons à icônes pour sélectionner plusieurs mesures; courbes superposées ou séparées.
- Échelles indépendantes explicites, valeurs avec leurs unités et curseur commun aux courbes et au parcours GPS; pics et interruptions conservés.
- Vérification mobile sur données fictives : enregistrement du ressenti, changement de disposition et curseur synchronisé.

## 2026-10-04 — Lecture de coaching contextualisée

- Intention de séance, consigne, objectif sportif et niveau transmis sans identité ni données GPS.
- Direction de l’allure calculée correctement (temps/km inférieur = plus rapide), ampleur des écarts rapportée à la tolérance.
- Croisement réalisation/ressenti et priorités selon la séance; conseils attendus concrets, hypothèses distinguées des causes établies.
- Comparaison réelle sur endurance trop rapide et intervalles respectés : réponses distinctes reçues en environ 18 et 22 secondes. Le modèle reste parfois générique; ce test ne valide pas un jugement de coach expert.
- Références aux mesures contraintes dans le schéma de génération et vérifiées à la réception.
- Méthode de lecture versionnée : les anciennes lectures restent stockées, mais une nouvelle génération est nécessaire pour cette méthode.


## 2026-10-04 — Ollama installé et validé sur le Mac

- Ollama 0.35.1 installé; Qwen3 8B téléchargé, présélectionné et exécuté sur le GPU du M4 à 16 Go.
- Service utilisateur com.foulee.ollama au démarrage de session, écoute sur localhost et fonctions cloud désactivées.
- Contexte de narration qualitatif, sans mesures numériques à recalculer; chiffres générés rejetés par le serveur. Réflexion Qwen3 désactivée pour les lectures courtes.
- Test réel via l’API authentifiée Foulée, sur données fictives : lecture JSON française validée en 13,7 secondes à chaud. Aucun exercice utilisateur modifié.
- Tests serveur et applicatifs réussis; roadmap actualisée.


## 2026-10-04 — Communication avec un LLM local

- Connexions Ollama et LM Studio via le serveur Mac, routes authentifiées et transport limité à la boucle locale.
- Choix du modèle installé, contexte réduit au bilan et au ressenti, réponse JSON validée avec références aux critères.
- Lecture enregistrée par exercice, détection du contexte obsolète, gestion des erreurs et des générations concurrentes.
- Réglages du service automatique conservés lors de sa réinstallation; cache PWA mis à jour.
- Contrats et routes testés avec un LLM simulé; validation avec un modèle réel encore à effectuer.


## 2026-10-04 — Moteur d’interprétation des exercices

- Analyse déterministe versionnée : durée totale, durée et allure moyenne des blocs de travail associés explicitement, RPE et ressenti.
- Tolérances réglables, écarts expliqués et liste des éléments non évalués.
- Associations ambiguës ignorées; associations réinitialisées au changement de séance ou au réimport.
- Aucun changement automatique du plan; cache PWA mis à jour.

## 2026-10-03 — Pente dans la bulle GPS

- Ajout de la pente en %, synchronisée avec le graphique : signe positif en montée, négatif en descente.
- Même calcul GPS sur 100 mètres; interpolation signalée et absence de mesure indiquée par —.
- Cache PWA mis à jour.

## 2026-10-03 — Bulle de mesures sur la carte GPS

- Sélection sur les graphiques : petite bulle près du repère GPS avec temps écoulé, BPM, allure et altitude.
- Valeurs synchronisées avec les courbes; interpolation signalée par ≈, mesures absentes indiquées par —.
- Bulle de taille fixe lors du zoom, maintenue dans les limites de la carte et masquée si la position GPS est indisponible ou hors champ.
- Vérification navigateur mobile / desktop du contenu, du zoom et du positionnement; tests des mesures absentes et interpolées.
- Cache PWA mis à jour.

## 2026-10-03 — Repères GPS discrets et de taille fixe

- Un seul numéro par phase, même lorsque la trace comporte plusieurs segments; au maximum huit numéros visibles, espacés pour éviter les chevauchements.
- Numéros de 10 px et petits repères de départ / arrivée / position sélectionnée; taille constante à l’écran lors du zoom et du redimensionnement.
- Vérification navigateur mobile et desktop : traces segmentées, quantité de numéros, taille des repères et gestes de zoom. Tests de régression sur l’échelle et les collisions.
- Cache PWA mis à jour.

## 2026-10-03 — Zoom de la carte GPS

- Boutons + / − et retour à la vue complète du parcours.
- Zoom par pincement et déplacement tactile; glissement à la souris et commandes clavier également disponibles.
- Fond OpenStreetMap chargé selon la zone et le niveau de zoom; trace GPS et repère synchronisé conservés.
- Vérification navigateur des boutons, pincement, déplacement tactile et souris, limites de zoom, réinitialisation et fond de carte. Tests existants réussis; gestes à confirmer sur iPhone physique.
- Cache PWA mis à jour.

## 2026-10-03 — Navigation interne sur iPhone

- Liens internes gérés sans rechargement du document; navigation précédent / suivant conservée.
- Profil choisi mémorisé pour la session afin de conserver l’espace lors d’un rechargement. Changer d’utilisateur efface ce choix.
- Destination plans / profil / exercices conservée lorsqu’un choix de profil est nécessaire.
- Vérification navigateur mobile : plans, exercices, rechargement, précédent / suivant et changement de profil; tests existants réussis.
- Cache PWA mis à jour.

## 2026-10-03 — Édition de séance sur iPhone

- Éditeur dédié en plein écran sur mobile, avec défilement indépendant des champs et actions toujours visibles.
- Champs regroupés en échauffement, bloc principal et retour au calme; saisie numérique adaptée et cibles tactiles de 48 px.
- Durée et distance recalculées en direct; annulation sans modification, retour à la séance après enregistrement et gestion du focus.
- Vérification navigateur aux largeurs 320, 390 et 768 px : affichage, calcul, annulation et enregistrement. Validation sur iPhone physique restant à faire.
- Cache PWA mis à jour.

## 2026-10-03 — Suppression des plans

- Action Supprimer sur chaque plan, avec confirmation et conservation des exercices importés.
- Sélection automatique d’un plan restant ou retour à la bibliothèque vide après suppression du dernier plan.
- Liste vide conservée sans réimporter un ancien plan; copie de compatibilité et cache PWA mis à jour.

## 2026-10-03 — Interface responsive iPhone / PWA

- Police système Apple sur iPhone et Mac, y compris les titres et les formulaires.
- En-tête sans hauteur fixe et actions regroupées dans Options; accès aux imports, exports et au changement de profil conservé.
- Formulaires, séances, plans, éditeurs et graphiques adaptés aux petites largeurs; champs à 16 px et commandes tactiles de 44 à 48 px.
- Roadmap présentée en cartes avec catégories et état sur mobile; tableau conservé sur grand écran.
- Prise en compte des zones sûres de l’écran en PWA, des boîtes de dialogue et des préférences de mouvement réduit.
- Vérification navigateur avec données fictives : accueil, profil, plans, exercices et roadmap à 320, 390, 430, 768 et 1024 px, sans débordement horizontal; éditeur de séance vérifié à 320 px.


## 2026-10-03 — Application installable PWA

- Manifeste, icônes standard / maskable / Apple et ouverture autonome.
- Aide à l’installation avant connexion; dialogue natif sur navigateurs compatibles.
- Service worker avec écran de reconnexion hors ligne, cache limité aux ressources publiques et mise à jour à la demande.
- Routes statiques et type MIME du manifeste autorisés par le serveur; fichiers publics revalidés.
- Roadmap mise à jour : PWA implémentée, accès HTTPS sur iPhone à configurer.


## 2026-10-03 — Page Fonctionnalités / Roadmap

- Accès depuis l’accueil et le choix du profil, avec retour à l’accueil.
- Inventaire des fonctions existantes et prévues, classées MVP ou Analyse Expert par une petite coche.
- État indépendant : coche verte pour les fonctions implémentées, panneau travaux pour celles en cours ou à venir.
- Priorité explicite à la personnalisation, à la comparaison prévu / réalisé et à l’adaptation; validation sur Watch réelle suivie séparément de l’export.


## 2026-10-03 — Instant commun aux courbes et au GPS

- Un clic, un toucher ou une sélection au clavier pilote désormais un instant commun à tous les graphiques et au parcours GPS.
- Curseurs alignés, points et valeurs actualisés ensemble; repère rouge sur la carte avec les coordonnées correspondantes.
- Interpolation explicitement signalée lorsque les mesures ont des horaires différents. Pas d’extrapolation hors des périodes couvertes ni de position estimée entre deux routes ou à travers une coupure GPS.
- La sélection est conservée quand la vue est actualisée et reste propre à chaque exercice et profil.

## 2026-10-03 — Imports sans plafond de taille

- Suppression de la limite de 20 Mo des exercices et du plafond de 12 Mo de leur bibliothèque.
- Confirmation avant lecture uniquement pour les fichiers de plus de 100 Mo, également sur les imports de dossiers et de résultats. Une annulation ne lit pas le fichier.
- Suppression du plafond de requêtes de synchronisation côté serveur.
- Cache en mémoire pour les exercices lorsque localStorage atteint son quota; sauvegarde et rechargement depuis la base du Mac.

## 2026-10-03 — Graphiques interactifs des exercices

- Courbes vectorielles affinées, sans accumulation de points, avec épaisseur constante selon la taille d’écran.
- Sélection au clic ou au toucher : curseur, mesure et instant; navigation avec les flèches, Début et Fin du clavier. La lecture utilise les données complètes même si la courbe affichée est simplifiée.
- Axe vertical de l’allure inversé : les allures les plus rapides apparaissent en haut.
- Nouveau graphique de pente en %, calculée sur les 100 derniers mètres horizontaux GPS; les coupures de parcours et les altitudes invalides interrompent le calcul. Compatible avec les exercices déjà enregistrés.

## 2026-10-03 — Module d’exercices unitaires

- Nouvelle page Exercices accessible depuis le profil actif, indépendante des plans.
- Import d’un JSON contenant une activité détaillée, détection des doublons et bibliothèque par profil synchronisée et incluse dans les exports de dossiers.
- Tracé GPS projeté avec départ/arrivée, fond OpenStreetMap à la demande, graphiques de fréquence cardiaque, allure, pas/min et altitude.
- Conversion des vitesses selon leur unité, calcul des pas/min sur leurs intervalles et estimation D+/D− depuis les altitudes GPS.
- Données absentes et erreurs de fichiers signalées; stockage des seules données utiles aux vues.
- Serveur : autorisation du nouveau script et plafond de requêtes porté à 16 Mo pour les mesures détaillées.

## 2026-10-03 — Import des résultats Santé volumineux

- L’importateur retire les blocs détaillés `healthKit` avant l’analyse du JSON; les 11 000 échantillons environ présents dans le fichier test ne gonflent plus l’objet chargé par Safari.
- Quand l’export n’est pas rattaché à un identifiant de séance et qu’aucune date ne correspond exactement, une boîte de dialogue permet d’associer chaque activité à la séance du plan voulue.
- Ajout d’un résumé des activités importées, d’une option d’ignorance et d’une validation contre les doubles associations.

## 2026-10-03 — Nouvelle direction visuelle inspirée du DSFR

- Remplacement du vert dominant par un bleu profond et des neutres clairs, avec un accent rouge réservé aux repères importants.
- Simplification des surfaces, contours, champs et boutons pour retrouver les contrastes francs et la sobriété fonctionnelle du design public français.
- Conservation de l’identité Foulée; aucune marque, police ou ressource officielle du DSFR n’est intégrée.

## 2026-10-03 — Export détaillé des exercices iOS / Apple Watch

- Ajout d’un module indépendant de sélection manuelle des exercices Santé, tous sports et toutes dates disponibles.
- Export JSON du résumé, des statistiques, des mesures associées horodatées, des événements, activités, métadonnées, sources, appareils et parcours GPS lisibles.
- Rattachement optionnel explicite à la séance Foulée importée ; conservation du format de résultats existant.
- Les erreurs partielles sont enregistrées dans le fichier ; les autorisations refusées et les mesures absentes restent indiscernables dans HealthKit.


## 2026-10-03 — Direction visuelle plus moderne

- Réchauffement de la palette avec des verts plus francs, une touche corail et un fond crème aux halos discrets.
- Renforcement de la hiérarchie typographique et des boutons d’action, avec des cartes plus douces et lisibles.
- Harmonisation des écrans de sélection, des formulaires, de la bibliothèque des plans et du calendrier, y compris sur mobile.

## 2026-10-03 — Gestion des plans d’entraînement

- Remplacement du formulaire toujours affiché par une bibliothèque de plans enregistrés avec objectif, temps visé, date de course et progression.
- Ajout d’un parcours distinct pour créer un plan, consulter son calendrier et modifier ses réglages.
- Les plans sont conservés séparément par profil; l’ancien plan unique est repris automatiquement dans la bibliothèque.
- La modification des réglages conserve les séances déjà réalisées lorsque date et type de séance correspondent.
- Les séances d’un plan restent modifiables depuis son calendrier et sont enregistrées au fil des changements.

## 2026-10-03 — Persistance durable et partage local

- Ajout d’un serveur Python avec base SQLite persistante dans `~/Library/Application Support/Foulee`.
- Les données existantes du navigateur sont importées automatiquement à la première connexion; les appareils connectés récupèrent ensuite les mêmes profils et plans.
- Ajout d’un code d’accès local, de sessions temporaires et d’une limitation des essais de connexion.
- Ajout de sauvegardes quotidiennes de la base SQLite, avec rotation sur 30 jours.
- Ajout d’un LaunchAgent macOS pour lancer le serveur à l’ouverture de session et le relancer s’il s’arrête; commandes d’installation, d’état et de retrait documentées.
- Les changements d’un autre appareil sont récupérés automatiquement lorsque l’écran n’est pas en cours d’édition.

## 2026-09-27 — Séparation de l’écran d’entrée et des espaces

- Ajout d’un écran d’accueil réduit au choix d’un profil existant ou à la création d’une nouvelle personne.
- Le choix d’un profil ouvre son espace de coaching; le profil actif est visible dans l’en-tête.
- Ajout de « Changer d’utilisateur », qui revient à l’écran de sélection et masque les données jusqu’au choix suivant.
- Le bouton de création crée un espace puis ouvre directement le module de création du profil sportif.
- Lors d’un premier chargement, les anciennes données sont migrées comme auparavant; l’application n’invente plus un profil vide si aucune donnée n’existe.

## 2026-09-27 — Profil actif depuis l’accueil

- Ajout d’un sélecteur de profil visible sur la page principale avec accès rapide à la création d’un profil.
- Le sélecteur de l’accueil et celui de l’en-tête restent synchronisés et changent l’espace actif de toute la session.
- Le résumé du plan nomme explicitement la personne à laquelle il est associé.

## 2026-09-27 — Nouvelle direction visuelle

- Refonte de la charte dans l’esprit des pages produit Apple : fond blanc, gris clair, typographie système, titres plus grands, espace et hiérarchie visuelle renforcés.
- Passage à des surfaces gris perle, des champs arrondis et un accent bleu pour les actions, états actifs et liens.
- Harmonisation des boutons, cartes de profil, historique, calendrier, détails de séance, éditeur et alertes.
- Recomposition de l’en-tête avec sélecteur de profil et contrôles compacts; navigation horizontale conservée sur petit écran.
- Aucun changement aux modèles de calcul, au stockage des profils ou aux formats d’import/export.

## 2026-09-27 — Espaces individuels et transfert des résultats

- Ajout d’un sélecteur de profils sportifs et de la création de plusieurs espaces sur un même navigateur; profil, historique, dernière séance et plan sont stockés séparément.
- Migration automatique des anciennes données locales vers le premier espace sportif existant.
- Ajout de l’export et de l’import individuel d’un dossier Foulée JSON (profil, courses, plan, dernière séance), pratique pour transférer les informations entre appareils. L’import en doublon crée une copie distincte.
- Les exports de séance incluent maintenant l’identifiant et le nom du profil ainsi que l’identifiant stable de la séance.
- Le compagnon iPhone peut lire les entraînements running de Santé pour la journée prévue et exporter un résultat `foulee-results-v1`; l’import dans le profil correspondant marque la séance comme faite et renseigne durée et distance.
- Les données restent locales; ce flux de fichiers ne synchronise pas automatiquement les appareils.
- Vérification sur Apple Watch réelle requise pour Santé, autorisations et programmation WorkoutKit.

## 2026-09-27 — Première passerelle Apple Watch

- Ajout de l’export individuel d’une séance du plan au format `foulee-watch-workout-v1`, avec date, blocs, répétitions et consigne.
- Ajout d’un projet compagnon iOS SwiftUI : import du JSON, aperçu de la structure, choix de la date, puis programmation via WorkoutKit après autorisation.
- Les blocs de travail et de récupération sont convertis en répétitions WorkoutKit sans ajouter de récupération fictive après la dernière répétition.
- Les cibles d’allure numériques donnent une plage d’alerte de vitesse sur les répétitions de travail; les consignes textuelles restent affichées dans l’aperçu.
- Après installation et acceptation de la licence Xcode, le compagnon compile pour iOS et iOS Simulator; il a été installé et lancé sur le simulateur iPhone 17. La programmation réelle reste à valider avec une Apple Watch jumelée.

## 2026-09-27 — Plan d’entraînement, suivi et interface

### Calcul des allures

- Ajout du choix de la course de référence : dernière course, une course précise de l’historique, ou aucune course.
- Les projections utilisent la formule de Riegel pour comparer des distances. À partir d’un résultat, le prototype dérive l’allure seuil du rythme extrapolé sur 10 km (+ 6 s/km), et l’allure d’intervalles du rythme extrapolé sur 5 km (+ 8 s/km).
- Sans résultat sélectionné, les allures sont estimées depuis le temps visé et clairement signalées comme provisoires.
- Ajout d’une correction manuelle du seuil. La valeur automatique reste visible, la provenance du calcul est expliquée et le plan est régénéré avec l’allure saisie.
- Alertes d’écart : jusqu’à 15 s/km, faible; de 16 à 29 s/km, à vérifier; de 30 à 59 s/km, important; 60 s/km ou plus, très important.

### Plan ajustable

- Ajout des jours habituels de course, avec un nombre de jours qui doit correspondre aux séances hebdomadaires choisies.
- Chaque séance a une date et une durée planifiée modifiables.
- Une séance marquée manquée peut être déplacée au premier jour libre, jusqu’à 14 jours plus tard. Le déplacement évite une date déjà occupée et laisse au moins deux jours entre les séances de qualité.
- Le déplacement ne recompose pas le volume total de la semaine; les autres séances restent en place.

### Suivi des séances

- Statuts « À faire », « Faite » et « Manquée » pour chaque séance.
- Saisie de la durée réalisée et comparaison avec la durée prévue.
- Résumé du nombre de séances réalisées et des minutes planifiées/saisies.
- L’historique du plan et le suivi restent dans le stockage local du navigateur.

### Interface

- Réorganisation des pages Profil et Plan, sélection des jours sous forme de boutons, cartes de suivi et état visuel des séances.
- Ajustements responsive et états de focus pour les commandes principales.

## Limites connues

- Les allures restent des estimations heuristiques; elles ne mesurent pas le seuil physiologique et doivent être vérifiées par l’utilisateur.
- Le plan n’ajuste pas automatiquement les autres séances après une séance manquée ou une modification de durée.
- Les dates sont modifiables, mais l’application ne synchronise pas encore le plan avec Calendrier ou Apple Watch.

## 2026-09-27 — Détail et édition des séances

- Chaque séance du plan affiche en lecture seule sa durée totale, son échauffement, les répétitions de travail, le rythme ou l’effort, la distance de travail estimée, les récupérations et le retour au calme.
- La distance de travail est calculée depuis la durée et le rythme quand l’allure est numérique; une séance guidée à l’effort indique que sa distance n’est pas estimée.
- Suppression de l’édition directe de la durée prévue dans la ligne du planning.
- Ajout du bouton « Éditer la séance » qui ouvre un panneau latéral dédié sur grand écran (sous la séance sur petit écran). Les blocs et le rythme/effort sont modifiables; la durée totale et la distance sont recalculées.
- Correction des détails des anciennes séances : une structure vide, incomplète (notamment sans bloc de travail), négative ou dont la somme ne correspond pas à la durée prévue est reconstruite au rendu et enregistrée dans le plan local.
- Le chargement utilise un nouveau nom de script pour contourner une éventuelle ancienne copie en cache.

## 3 octobre 2026 — Phases des exercices importés

- Conservation du découpage `healthKit.activities` dans les résultats d’exercice, avec durée, distance, allure et identifiant d’étape.
- Affichage optionnel de bandes colorées sur les courbes et de segments correspondants sur le parcours GPS, sans relier les interruptions de trace.
- Validation avec le fichier fourni : neuf phases; tests de normalisation, limites GPS et activation des overlays dans Chrome.
- Réimport nécessaire pour enrichir les exercices déjà stockés; feedback conservé.

## 4 octobre 2026 — Fonds de carte au choix

- Sélecteur de cinq styles vectoriels OpenFreeMap, ancien OpenStreetMap et tracé seul hors connexion; choix conservé sur l’appareil.
- Alignement Mercator du fond avec le tracé SVG, zoom, déplacement, repères de phases et curseur commun conservés.
- Chargement à la demande, attribution visible et message de repli si le fond ne peut pas charger.
- Tests de projection centre / zoom / largeur responsive et tests existants; vérification navigateur avec parcours fictif. Gestes sur iPhone physique restant à confirmer.

## 4 octobre 2026 — Connexion et mises à jour fiables

- Requêtes au Mac limitées dans le temps; une seule synchronisation en cours; session expirée effacée avant reconnexion.
- Action de reconnexion disponible dans Options après une erreur même si un jeton existe.
- Vérification manuelle des mises à jour toujours accessible; rechargement proposé après activation automatique d’une nouvelle version.
- Préférences graphiques locales exclues de la migration et de la récupération partagée.
- Authentification et lecture du serveur réel vérifiées en HTTP et HTTPS avec certificat validé; tests de timeout, reconnexion et activation PWA ajoutés.

## 4 octobre 2026 — Renommage et onglets des exercices

- Nom personnalisé enregistré par exercice, conservé lors des réimports.
- Quatre panneaux exclusifs : Ressenti, Dialogue LLM, Graphiques, Attendu / réalisé; navigation tactile et clavier.
- Enregistrement indépendant du ressenti et de la comparaison; conservation des brouillons pendant la session.
- Sélecteur de courbe, phases détaillées repliables et en-tête compact pour limiter le défilement.
- Vérification navigateur mobile / desktop avec exercice fictif : renommage, association, écart de durée, sauvegarde, brouillon et curseur graphique / GPS; tests de réimport ajoutés.

## 2026-10-05 — Dialogue LLM enregistré par séance

- Lecture initiale suivie de questions libres et de suggestions, avec transmission de l’historique aux deux fournisseurs locaux.
- Conversations datées, contexte et modèle conservés; brouillon sauvegardé et anciennes conversations consultables après une nouvelle lecture ou un changement de données.
- Présentation en bulles, observations dépliables et pistes mises en évidence, adaptée au mobile.
- Historique contrôlé côté serveur et nombre d’échanges limité; cache PWA actualisé.
