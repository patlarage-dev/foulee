# Foulée · compagnon Apple Watch

Cette app iPhone importe un fichier `foulee-watch-workout-v1.json` exporté depuis une séance du plan Foulée ou un exercice libre, affiche les blocs, puis programme la séance dans l’app Exercice avec WorkoutKit.

## Utilisation

1. Dans Foulée, ouvre le plan et clique sur **Exporter pour l’app iPhone** sur une séance.
2. Transfère le fichier JSON vers l’iPhone, par exemple avec AirDrop ou iCloud Drive.
3. Ouvre `FouleeWatchCompanion.xcodeproj` dans Xcode, sélectionne l’iPhone et une équipe de signature, puis lance l’app.
4. Dans l’app iPhone, importe le JSON, vérifie les blocs et la date/heure, puis autorise la programmation.
5. La séance programmée apparaît dans l’app Exercice de l’Apple Watch jumelée. Foulée transmet l’identifiant de la personne et de la séance dans le fichier d’export.
6. Après la course, dans l’app compagnon, ouvre **Exporter les résultats d’un exercice**, puis **Charger les exercices depuis Santé**. Autorise les données souhaitées, sélectionne l’exercice et touche **Exporter l’exercice choisi**.
7. Pour mettre à jour une séance du plan, importe d’abord sa séance dans le compagnon et active **Rattacher à la séance** avant l’export. Dans l’espace de cette personne sur Foulée, sélectionne **Importer résultats** et choisis ce fichier. La séance est marquée comme faite et sa durée et sa distance sont renseignées.

L’app Exercice de watchOS exécute et enregistre les exercices. Le module d’export est accessible même sans séance Foulée importée : il présente tous les exercices lisibles, du plus récent au plus ancien, sans filtre de date ou de sport. La sélection est manuelle ; aucun exercice n’est choisi automatiquement.

Le JSON conserve le format `foulee-results-v1` et ajoute `detailVersion: 1` et `results[].healthKit` :

- Résumé : dates de début et fin, durée active et écoulée, distance, énergie, allure moyenne, identifiant Santé.
- Toutes les statistiques de l’exercice et de ses activités : somme, moyenne, minimum, maximum et valeur la plus récente disponibles, avec unités.
- Échantillons horodatés associés à l’exercice pour les mesures sportives prises en charge : fréquence cardiaque, énergie, distances, pas, puissance, vitesse, foulée, oscillation verticale, contact au sol, vélo, natation, effort et autres mesures présentes dans ses statistiques.
- Événements (pauses, reprises, tours, segments), activités d’une séance multisport et métadonnées.
- Parcours GPS disponibles : coordonnées, altitude, précision, vitesse et direction horodatées.
- Source, appareil et métadonnées des données ; erreurs de lecture partielles dans `warnings`.

Les mesures ne sont jamais recherchées simplement par proximité horaire : elles doivent être associées à l’exercice dans Santé. Une mesure absente ou interdite reste absente ; Santé ne permet pas de distinguer ces deux situations. Les autres données du dossier Santé, les séries spécialisées comme les battements individuels, et les indicateurs privés de Fitness ne sont pas exportés. Les métadonnées non JSON sont conservées sous forme textuelle. L’import web actuel utilise le résumé (durée, distance, allure) ; les détails restent consultables dans le fichier JSON.

Aucun résultat n’est envoyé automatiquement à un serveur. Enregistre le fichier dans Fichiers ou partage-le depuis Fichiers. Pour une installation sur iPhone, l’équipe de signature choisie dans Xcode doit disposer de la capacité HealthKit.

## Limite de l’environnement

Le projet cible iOS 17 ou ultérieur et s’appuie sur WorkoutKit. Il compile pour iOS et le simulateur, et a été installé et lancé sur un simulateur iPhone 17. La programmation dans l’app Exercice doit encore être validée sur un iPhone jumelé à une Apple Watch réelle.

### Exercices libres et contrat d’export

La date prévue est choisie dans Foulée et conservée dans `scheduledDate` (`yyyy-MM-dd`, jour local). Le compagnon propose 7 h ce jour-là, ou une heure future si cette date est passée ; l’heure reste à confirmer sur iPhone. Les exercices libres utilisent désormais `foulee-watch-workout-v1`, comme les séances du plan.

Le fichier contient l’identité du profil, un identifiant stable de séance, le nom, le type, la durée totale en minutes, une structure de secours et les phases ordonnées (identifiant, nom, durée en secondes, consigne et indicateur travail/récupération). Les blocs de répétition sont explicites : toutes les phases sélectionnées sont exécutées à chaque tour, y compris la dernière récupération du bloc. Plusieurs blocs peuvent être séparés par des phases indépendantes. Les durées en secondes et les minutes décimales sont prises en compte. L’aperçu iPhone affiche les phases effectivement programmées.

WorkoutKit programme ici une course en extérieur avec des objectifs de temps. Les allures chiffrées donnent une plage de vitesse cible de ±5 %. Les consignes textuelles, le type Foulée et la note sont des informations de contexte ; ils ne créent pas d’alerte vocale ni de cible de distance sur la montre. Les exports de dossier individuel servent à la sauvegarde et ne sont pas des séances importables dans le compagnon.
