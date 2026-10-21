# Spécification fonctionnelle et technique — SQUAD-COMMAND

Ce document décrit le comportement observé dans le code du projet. Les règles indiquées ci-dessous correspondent à l’implémentation actuelle ; elles ne constituent pas une feuille de route.

## 1. Présentation

SQUAD-COMMAND est un jeu tactique d’action en 2D, réalisé avec JavaScript et p5.js. Le joueur contrôle un commandant, recrute jusqu’à six soldats en plus de lui, protège une base et affronte des vagues d’ennemis. Il peut donner des ordres à des soldats individuellement, combattre avec son fusil après l’avoir découvert, récupérer de l’or et utiliser une infirmerie.

Une partie se déroule sur l’une des quatre cartes : forêt boréale, laboratoire intérieur, avant-poste militaire ou arène tactique. La mission progresse sur cinq niveaux. La destruction de la base mène à la défaite ; la fin du cinquième niveau mène à la victoire.

## 2. Fonctionnalités principales

### Déplacement et monde

- Le commandant se déplace en suivant le pointeur par défaut. Le réglage **Contrôle du commandant** permet de choisir le suivi de la souris ou le déplacement par destination au clic.
- Les unités mobiles utilisent des forces de steering et la locomotion de `Vehicle`. Les obstacles comprennent notamment arbres, rochers, caisses et éléments du décor ayant une collision.
- Les cartes définissent les positions des recrues, pièces, obstacles, indices, ennemis et de l’infirmerie dans `src/game/levels.js`.

### Escouade et recrutement

- Le joueur peut recruter jusqu’à six soldats en touchant les recrues placées sur la carte. La première vague commence lorsque trois soldats sont recrutés.
- Les soldats peuvent être sélectionnés, envoyés contre une cible, dispersés pour rechercher automatiquement des ennemis ou regroupés en formation.
- Une mission d’attaque individuelle reste attachée au soldat concerné. Les autres ordres ne remplacent pas ces missions, sauf commande adressée explicitement à ces soldats.

### Ennemis, combat et boss

- Les ennemis progressent vers le commandant, les soldats ou la base, et infligent des dégâts lorsqu’ils atteignent leur cible. Ils ont des points de vie et peuvent être éliminés.
- Les soldats armés tirent sur leurs cibles à portée et avec une ligne de vue dégagée. La touche **T** permet au commandant armé de tirer ; le tir commande aussi un tir de soutien des soldats en formation qui ont un fusil, si la cible est à leur portée.
- La hache de départ sert à creuser au point indiqué ; elle ne sert pas au combat. La fouille procure l’objet de la carte. Dans la forêt, cet objet est le fusil nécessaire au tir du commandant.
- À partir du niveau 3, le Colosse apparaît dans la première vague du niveau. Il possède davantage de santé, une barre de vie et deux attaques spéciales télégraphiées : onde de choc de zone et charge. Sa défaite accorde de l’or et une courte transition de victoire.

### Ressources, objets et soins

- Les pièces d’or sont attirées automatiquement lorsque le commandant entre dans leur rayon d’attraction ; elles sont collectées à son contact et comptées une seule fois.
- La cache signalée par un indice se fouille avec **E** à proximité. Les objets varient selon la carte : fusil en forêt, kit médical au laboratoire, blindage à l’avant-poste et cellule à impulsion dans l’arène. Les objets autres que le fusil accordent leur effet indiqué dans l’aide du jeu.
- L’infirmerie soigne une fois par partie les unités blessées proches lorsque le commandant est dans sa zone et utilise **H**. Le kit médical du laboratoire étend le rayon des unités soignées. Un soin n’est consommé que s’il restaure effectivement de la santé.

### Progression

- Chaque niveau comporte exactement deux vagues. La vague suivante arrive après élimination de tous les ennemis de la vague courante ; le niveau suivant commence après la seconde vague.
- Le nombre d’ennemis et leur résistance augmentent avec le niveau. À partir du niveau 3, le boss est inclus dans la première vague (il ne crée pas une troisième vague).
- Le HUD indique le niveau, la vague, les hostiles restants et la progression. Le cinquième niveau terminé conclut la mission.

## 3. Commandes du joueur

| Entrée | Action actuelle |
| --- | --- |
| Clic gauche / déplacement de souris | En mode suivi, le commandant suit le pointeur. En mode clic, un clic sur le terrain donne une destination. |
| Clic gauche sur un hostile | Sélectionne la cible de tir. |
| Clic gauche sur une unité | Sélectionne l’unité. **Maj + clic** ajoute ou retire une unité de la sélection. |
| **D maintenu + clic sur un ennemi** | Envoie un soldat en formation à l’attaque ; chaque clic affecte un soldat disponible. |
| **D maintenu + clic sur un soldat** | Ajoute ce soldat à la sélection et lui attribue automatiquement une cible lorsqu’un ennemi est actif. |
| **D maintenu + clic sur le terrain** | Donne un ordre tactique de déplacement aux soldats concernés. |
| **E** | Creuse à l’indice si le commandant est suffisamment proche. |
| **F** | Fait fuir le commandant et les soldats sélectionnés d’une menace proche ; la fuite se termine lorsqu’ils sont en sécurité ou reçoivent un nouvel ordre. |
| **H** | Utilise le soin de l’infirmerie si le commandant est dans la zone et si le soin est encore disponible. |
| **P** | Disperse les soldats sélectionnés, ou toute l’escouade si rien n’est sélectionné, et lance leur recherche automatique d’ennemis. |
| **R** | Regroupe les soldats sélectionnés, ou toute l’escouade si rien n’est sélectionné. Après une victoire ou une défaite, **R** recommence la mission. |
| **T** | Le commandant tire si le fusil a été récupéré et qu’une cible valide est à portée. Les soldats sélectionnés reçoivent également l’ordre d’engager selon les règles du système de combat. |
| **Échap** | Met en pause ou reprend la partie. En plein écran, quitte le plein écran. |
| **Entrée** | Démarre depuis le menu ; après une victoire ou défaite, recommence la partie. |
| Boutons d’interface | Contrôlent pause, redémarrage, engagement, dispersion, regroupement, réglages, aide, plein écran et visibilité du panneau latéral. |

## 4. Intelligence artificielle et steering

Le code sépare le choix d’action (ordres dans `src/game/game.js` et `src/ui/command-controller.js`), le calcul des forces (classes d’entités et comportements), puis la locomotion héritée de `Vehicle`.

| Comportement utilisé | Rôle dans le jeu | Implémentation |
| --- | --- | --- |
| `seek` | Déplacement vers une cible à vitesse désirée. | `Vehicle.seek()` dans `behaviors/vehicle.js`, base pédagogique locale. |
| `arrive` | Approche avec ralentissement près de la destination. | `Vehicle.arrive()` dans la base ; `ArrivalVehicle` spécialise le calcul dans `behaviors/arrival-vehicle.js`. |
| `flee` | Éloignement du commandant ou des soldats par rapport à une menace. | `Vehicle.flee()` dans `behaviors/vehicle.js`. |
| `wander` | Comportement générique disponible sur la base. | `Vehicle.wander()` dans `behaviors/vehicle.js` ; le jeu ne s’en sert pas comme commande principale des unités. |
| Évitement multi-rayons (comportement 6 modifié) | Examine, pour chaque rayon, la position de l’unité, `ahead2` et `ahead`, puis moyenne les forces des rayons menacés. | `VehicleAvecRadar.avoidMulti()` dans `behaviors/vehicle-avec-radar.js`. Cette variante locale reprend le comportement 6 modifié ; elle ne remplace pas les méthodes de la base. |

Les soldats (`src/entities/squad-agent.js`), ennemis (`src/entities/enemy.js`) et pièces (`src/entities/gold-coin.js`) spécialisent la classe à radar. Leurs déplacements combinent les forces d’arrivée/approche et d’évitement selon leur état. Le boss étend `Enemy` dans `src/entities/boss-enemy.js`. Les ordres d’attaque, de recherche, de fuite et de formation sont des états de jeu, pas de nouveaux comportements de steering.

La classe pédagogique `Vehicle` fournit aussi `applyForce()`, `update()`, les limites et la représentation de base. Les fichiers locaux de spécialisation sont chargés après la base. Aucun comportement de steering supplémentaire n’est défini dans cette spécification.

## 5. Règles de jeu détaillées

- **Recrutement :** le contact avec une recrue l’ajoute à l’escouade, jusqu’à six soldats en plus du commandant. Le HUD affiche le nombre de soldats sur six. Trois soldats recrutés déclenchent la première vague.
- **Ordre ciblé :** chaque clic `D + ennemi` attribue un soldat disponible en formation. Le soldat poursuit cette cible et l’attaque jusqu’à élimination ou fin de sa mission. Les clics suivants peuvent affecter d’autres soldats au même ennemi.
- **Sélection / engagement :** `T` engage les soldats sélectionnés. Lorsqu’aucune sélection n’existe, les tirs de soutien associés au tir du commandant concernent les soldats armés en formation.
- **Dispersion :** les unités ciblées reçoivent des destinations réparties et passent en recherche ; elles acquièrent ensuite automatiquement des ennemis proches.
- **Regroupement :** les unités ciblées reviennent aux points de formation autour du commandant. Si une mission individuelle est déjà confiée à un soldat non ciblé par cette commande, elle reste en cours.
- **Fouille et équipement :** `E` révèle l’objet de la cache proche. Le fusil débloque le tir du commandant avec `T`. Les autres bonus agissent conformément à leur description dans l’aide.
- **Tir :** les projectiles sont matérialisés par des effets visuels. Les tirs nécessitent une portée et une ligne de vue ; les cooldowns et dégâts sont gérés par le jeu.
- **Or :** une pièce devient attirée dans son rayon d’aimantation, rejoint le commandant par déplacement, puis incrémente le compteur à la collecte.
- **Soin :** un seul soin par partie ; il restaure les alliés blessés dans le rayon de l’infirmerie lorsque les conditions sont remplies.
- **Défaite :** les attaques ennemies réduisent la santé de la base et des unités ; la destruction de la base termine la mission.

## 6. Interface utilisateur

- **Écran d’accueil :** choix parmi les quatre environnements et bouton PLAY.
- **HUD de combat :** effectif de l’escouade, ennemis restants, vague, niveau, santé de la base, secteur, état de l’infirmerie et notifications de mission.
- **Progression :** barre de progression du niveau et du compte d’ennemis ; le panneau du boss affiche sa santé lorsqu’il est actif.
- **Équipement et ressources :** bandeau affichant l’outil ou l’arme du commandant et le total d’or.
- **Aide de commandes :** panneau latéral repliable contenant les raccourcis et règles propres aux objets et niveaux.
- **Escouade :** panneau latéral affichant le recrutement, les ordres rapides et la liste des unités ; les unités peuvent être sélectionnées depuis cette liste.
- **Réglages :** choix de carte et de mode de contrôle, volumes et interrupteurs séparés pour musique et effets sonores, mode debug et redémarrage.
- **Plein écran :** bouton dans l’interface ; Échap ou le contrôle natif du navigateur permet d’en sortir. Le panneau latéral peut être masqué pour élargir le champ de jeu.
- **Debug :** bouton des réglages affichant les informations de simulation, dont positions, destinations, obstacles/collisions, cibles, affectations et états de déplacement.

## 7. Architecture technique et sources de référence

- `index.html` charge p5.js local, les comportements pédagogiques et leurs spécialisations, puis les données de niveaux, entités, jeu, contrôleur, audio et interface.
- `src/main.js` initialise p5, le jeu, les écouteurs de l’interface et les événements de pointeur/clavier.
- `src/game/game.js` orchestre la partie, les ordres, les vagues, les dégâts, les interactions et le rendu.
- `src/game/levels.js` contient les quatre configurations de carte.
- `src/ui/command-controller.js` traduit les clics et raccourcis en commandes de jeu.
- `src/entities/` contient les classes spécialisées : commandant, soldat, ennemi, boss, recrue, cache, pièces, infirmerie, base et obstacles.
- `behaviors/vehicle.js` est la base pédagogique locale ; `behaviors/arrival-vehicle.js` et `behaviors/vehicle-avec-radar.js` portent les spécialisations utilisées par le jeu.

La page utilise des scripts classiques chargés dans l’ordre de leurs dépendances et une version locale de p5.js. Le jeu n’a pas besoin de ressources graphiques distantes pour son fonctionnement.
