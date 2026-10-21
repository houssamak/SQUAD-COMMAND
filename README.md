# SQUAD COMMAND — Tactical Steering

Jeu tactique autonome en navigateur construit avec p5.js 1.7.0 et les bases de
steering du dépôt. Les soldats et ennemis utilisent `Vehicle` et sa locomotion;
leurs cibles d'ordre, états de santé et comportements restent indépendants.

## Lancer

Ouvrir `index.html`, ou démarrer un serveur local depuis ce dossier :

```bash
python -m http.server 8000
```

Puis ouvrir <http://localhost:8000/>. Aucun téléchargement ni paquet npm n'est
nécessaire.

## Jouer

- Le commandant suit la souris par défaut. Dans Réglages, choisissez « Clic pour
  déplacer » pour utiliser des destinations par clic. Les deux modes utilisent
  Arrival et l'évitement multi-rayons.
- Recrutez trois balises pour déclencher la première vague. Jusqu'à six soldats
  peuvent rejoindre l'escouade. HOME affiche l'objectif de mission et ses points
  de vie; les hostiles l'attaquent s'ils ne sont pas attirés par une unité proche.
  La mission échoue si HOME ou le commandant est neutralisé.
- La mission comporte cinq niveaux de deux vagues. Le HUD indique le niveau, la
  vague en cours, les hostiles restants et la progression dans le niveau. Une
  courte transition annonce chaque nouveau niveau; la mission se termine après
  le niveau 5. Les vagues ajoutent progressivement des hostiles et augmentent
  leur résistance et leur rythme d'attaque.
- Dans l'interface de combat, le bouton panneau replie ou rétablit la colonne
  droite. La zone jouable prend l'espace libéré; le canvas et le monde sont
  redimensionnés ensemble. Le bouton plein écran agrandit la carte. `Échap` ou
  le bouton × quitte le plein écran; hors plein écran, `Échap` garde pause/reprise.
- Les messages de mission s'empilent dans la bande du haut, hors du décor. Trois
  messages au maximum restent visibles et s'estompent à leur expiration.
- Dès le niveau 3, un Colosse rejoint la première vague de chaque niveau. Sa
  barre de vie apparaît à son arrivée. Le cercle rouge annonce son onde de choc;
  la ligne rouge indique la destination de sa charge. Quittez la zone ou le
  couloir avant l'impact. Le Colosse devient plus résistant et frappe plus fort
  aux niveaux suivants. Sa défaite rapporte de l'or.
- Cliquez un fusilier pour le sélectionner. `Maj + clic` ajoute ou retire une
  unité de la sélection. La liste à droite permet aussi la sélection individuelle
  et multiple avec Maj.
- Maintenez `D` puis cliquez un soldat pour l'ajouter à la sélection et lui
  assigner immédiatement une cible hostile. Répétez le geste pour ajouter des
  soldats; leurs cibles se répartissent entre les ennemis vivants. `D + clic`
  sur un ennemi envoie **un seul soldat disponible en formation**. Répétez le
  clic pour envoyer d'autres soldats; les badges près des ennemis affichent le
  nombre affecté. Les ordres déjà donnés ne changent pas. `D + clic` sur le sol
  donne des positions tactiques aux soldats sélectionnés.
- `F` déclenche la fuite du commandant si un ennemi est à 320 px ou moins. Il
  s'éloigne avec `Vehicle.flee()` et évite les obstacles avec le comportement 6.
  La fuite finit à distance de sécurité ou dès qu'un nouvel ordre est donné. F
  peut aussi faire fuir les soldats sélectionnés.
- `T` commande aux seuls soldats sélectionnés d'engager les cibles. Ils avancent
  jusqu'à leur portée de tir et gardent leur mission si la sélection change. Le
  commandant commence avec une hache qui sert uniquement à creuser. `E` près d'un
  indice permet de creuser et de récupérer le fusil; `T` permet alors au
  commandant de tirer. Les fusiliers qui le suivent appuient chacun de ses tirs
  sur la cible sélectionnée lorsqu'elle est à portée et visible. Cet appui
  temporaire respecte les missions individuelles; les soldats reprennent leur
  formation quand la cible est éliminée.
- Chaque carte possède une infirmerie adaptée à son décor. Entrez dans le cercle
  et appuyez sur `H` pour soigner le commandant et les alliés proches, une seule
  fois par partie. L'indicateur INFIRMERIE du HUD montre si le soin est disponible.
  Le kit médical du laboratoire augmente le rayon de ce soin. Chaque carte cache
  aussi un équipement à découvrir avec `E` près de son indice : chaque cache donne
  le fusil. Le laboratoire ajoute un kit qui élargit le soin, l'avant-poste donne
  un blindage qui absorbe trois dégâts, et l'arène une cellule qui renforce les
  trois prochains tirs. Les soldats gardent leur propre arme et comportement.
- Le bouton **Mode debug** dans Réglages affiche positions et destinations,
  rayons et marges d'obstacle, cibles, affectations, vitesses et états de steering.
  Il ne modifie pas la simulation et peut être désactivé à tout moment.
- `P` disperse la sélection, ou toute l'escouade si rien n'est sélectionné. Les
  soldats vont vers des positions distinctes, recherchent les ennemis proches,
  les poursuivent et attaquent. Après élimination, ils reprennent la formation;
  les soldats non sélectionnés conservent leurs ordres.
- Les pièces d'or suivent automatiquement le commandant à moins de 150 px en
  réutilisant `seek()` et l'évitement 6. Elles sont collectées une fois au contact;
  le compteur OR est dans le HUD.
- `R` rétablit de la même manière la formation. `Échap` met en pause; `R` dans
  l'écran de fin redémarre la mission.
- Les tirs ennemis sont des attaques avec portée, ligne de vue, cooldown et dégâts
  réels. Les barres de vie, effets de tir et indicateurs de fuite reflètent l'état
  de simulation.

Les panneaux et menus ne transmettent pas de clics à la carte. Le redimensionnement
remappe les positions et destinations en cours. Les raccourcis fonctionnent quand
un bouton ou une liste de réglage a le focus; les champs de saisie restent exclus.

## Comportements et tests

La cartographie des comportements, les responsabilités des classes et leurs
paramètres figurent dans [`docs/behavior-mapping.md`](docs/behavior-mapping.md).

Lancer les tests avec Node.js 18 ou plus récent :

```bash
node tests/avoidance-and-locomotion.test.cjs
```

La suite vérifie 45 cas, dont les soins hospitaliers limités à une utilisation,
les effets de locomotion, l'affectation incrémentale
d'un seul soldat par D+clic ennemi, la recherche P, les caches et tirs au fusil,
la collecte automatique des pièces, la fuite réelle du commandant, les niveaux à deux vagues,
les attaques télégraphiées et dégâts du Colosse, son ciblage par les soldats,
le dégagement autour d'obstacles, les ordres indépendants, les dégâts aux unités et à HOME, et
les deux modes de commande. Ces tests utilisent un adaptateur p5 minimal; les interactions
de canvas, le chargement p5 réel et les erreurs de console sont aussi vérifiés dans
Chrome.

Les sons synthétisés par Web Audio (sans fichier distant) démarrent après la
première interaction. Dans Réglages, les commandes Musique et Effets permettent
de couper chaque bus et de régler leur volume séparément. Vérifier leur logique
avec :

```bash
node tests/audio-manager.test.cjs
```

Les tirs utilisent un impact grave et un claquement filtré avec une réverbération
courte; le son du camp ennemi a une tonalité distincte. Une limite commune espace
les rafales simultanées. Les messages de mission passent par une seule pile dans
la barre supérieure : un texte déjà actif voit sa durée rafraîchie sur la même
carte, qui disparaît ensuite avec son fondu.

## Bases protégées et ressources

Les fichiers `vehicle.js` du cours et du projet n'ont pas été modifiés. La base
locale du projet conserve sa méthode héritée `flee(target)`; la variante complète
est consultable dans `2-PursueEvade/vehicle.js`. Le calcul du comportement 6 fourni
par l'utilisateur reste dans `VehicleAvecRadar.avoidMulti()`.

Voir [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) pour les mentions de p5.js.
