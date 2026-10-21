# Cartographie des comportements — SQUAD COMMAND

Cette cartographie decrit les classes de simulation, les commandes et les regles de gameplay du projet existant. Les bases `vehicle.js` restent protegees et inchangees.

## Hierarchie et sources

| Systeme | Fichier | Responsabilite |
| --- | --- | --- |
| Locomotion | `behaviors/vehicle.js` | Base `Vehicle`, `applyForce()`, `update()`, `seek()` et `flee()`. |
| Arrivee | `behaviors/arrival-vehicle.js` | `ArrivalVehicle` specialise `seek()` et fournit l'arrivee progressive. |
| Evitement, comportement 6 | `behaviors/vehicle-avec-radar.js` | `VehicleAvecRadar.avoidMulti()` conserve la variante modifiee : trois points testes par rayon, eventail de 120 degres, ahead a 30 x vitesse, ahead2 a 15 x vitesse, force par rayon maxForce/2 puis moyenne. |
| Personnages allies | `src/entities/squad-agent.js`, `soldier.js`, `commander.js` | Les agents utilisent Arrival, `avoidMulti()` et la locomotion heritee une fois par image. |
| Ennemis | `src/entities/enemy.js` | Les ennemis poursuivent avec Arrival et `avoidMulti()`, puis attaquent a portee avec ligne de vue et cooldown. |
| Pieces d'or | `src/entities/gold-coin.js` | `GoldCoin extends VehicleAvecRadar`; a moins de 150 px, reutilise `seek()`/`arrive()` et `avoidMulti()` vers le commandant. La scene l'integre une fois au contact. |
| Cache de fouille | `src/entities/world-cache.js`, `src/game/levels.js` | Indice statique par carte; `E` creuse a 48 px ou moins. |
| Contact obstacle | `src/game/obstacle-contact.js` | Regle de scene apres locomotion pour eviter le chevauchement residuel et glisser tangentiellement. Elle ne remplace pas le steering. |
| Hopital | `src/entities/hospital.js`, `src/game/levels.js` | Batiment statique present sur les quatre cartes; `H` soigne une fois par partie. |
| Commandes et simulation | `src/game/game.js`, `src/ui/command-controller.js` | La scene choisit les cibles, orchestre les entites et applique les degats; le controleur traduit les entrees. |

## Commandes et regles

- Le commandant suit la souris par defaut; le mode clic pour deplacer est disponible dans les reglages. Les deux modes passent par Arrival et la locomotion `Vehicle`.
- Le commandant commence sans arme a feu. La hache est un outil visuel de fouille uniquement. `E` pres d'une cache donne le fusil sur les quatre cartes; `T` permet ensuite au commandant de tirer jusqu'a 280 px, avec 1 degat et 9 images de cooldown.
- Les caches conservent aussi leur objet de carte : kit medical au laboratoire, trois charges de blindage a l'avant-poste, et trois tirs renforces dans l'arene. Le kit elargit le rayon de soin de groupe.
- `F` fait fuir le commandant d'un ennemi a 320 px ou moins. L'ordre precedent est restaure quand aucun ennemi ne reste dans ce rayon. Un nouvel ordre ou un second appui sur F annule la fuite. La force provient de `Vehicle.flee()` et est composee avec `avoidMulti()`; les soldats selectionnes conservent egalement leur fuite existante.
- `P` affecte les soldats selectionnes, ou toute l'escouade si rien n'est selectionne. Ils prennent des positions de recherche, detectent les ennemis a 260 px, les poursuivent et tirent; apres elimination, ils reprennent la formation. Les ordres des unites hors selection restent independants.
- `D + clic ennemi` envoie un soldat disponible en formation a chaque clic. Les missions de soldat deja occupe sont conservees. Les ennemis affichent le nombre d'affectations.
- Les soldats selectionnes gardent leur propre tir avec `T`, meme avant que le commandant trouve son fusil.
- Les pieces sont mobiles et attirent le commandant a moins de 150 px avec le `seek()` de la base, `arrive()` pour freiner, et le comportement 6 pour eviter les obstacles. Le compteur augmente une seule fois au contact.
- `H` soigne le commandant et les allies blesses dans la zone de l'hopital, une seule fois par partie. Les tentatives eloignees ou apres utilisation affichent une explication.
- Le bouton de debug affiche positions, vitesses, destinations, rayons, collisions, menaces, cibles, etat des missions et statut des pieces. Le rendu ne recalcule pas et n'applique pas les forces.

## Limites et validation

L'evitement est local, pas un pathfinder; un passage trop etroit peut rester bloquant. Les obstacles visibles utilisent les memes centres et rayons que la simulation.

Lancer depuis le dossier `SQUAD-COMMAND` :

```bash
node tests/avoidance-and-locomotion.test.cjs
```

Les 41 tests couvrent les comportements de steering, le mouvement reel des unites, les obstacles, l'affectation incrementale D, la recherche P et la fin de combat, les caches, le fusil, la fuite F, les pieces d'or et le soin hospitalier.

La validation navigateur avec Chrome et p5.js reel a verifie le deplacement, la fuite du commandant, la recherche et l'elimination d'un ennemi par P, le creusement E, le tir T, l'attraction et la collecte d'une piece, le bouton debug, et l'absence d'erreurs console.
