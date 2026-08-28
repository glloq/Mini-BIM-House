import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/**
 * Keeps the download the first visit pays for from growing unnoticed.
 *
 * The number that matters is what the browser must fetch before the
 * application appears — the page, its stylesheet and the modules it names —
 * compressed, since that is how it travels. Workspaces loaded on demand are
 * counted apart: they are what makes it possible to keep the first payload
 * small, and they must not be charged for it.
 *
 * A budget is a decision, not a measurement. Raising one is allowed; doing it
 * without noticing is not.
 */
export const BUDGETS = {
  /**
   * Page, stylesheet and the modules it references, gzipped.
   *
   * Raised from 200 kio when the editor gained the families and tools of the
   * ninth audit's lots C to H: walls drawn as runs, rooms, slabs, openings in
   * slabs, stairs, roofs described by their outline, placed components,
   * structure, the site, the graphical network editor and scenario mode. All
   * of it is the editor, which is what the first visit loads; the workspaces
   * behind it stay on demand, and the PDF chain was moved there.
   *
   * Raised again from 240 kio for the integrity work of the eleventh audit:
   * the index of what points at what, which every deletion asks before it
   * removes anything, and the clearance volumes the plan draws. Both are the
   * editor answering questions about the project on screen, so both are loaded
   * with it; what could wait — the nomenclature of five hundred families, the
   * catalogue browser, the checks — is still on demand.
   *
   * Raised again from 248 kio for the interface of the twelfth audit: the five
   * spaces and the navigation that remembers what is open in each, the design
   * scope and what it sets aside, the tools moved into the context panel, the
   * contextual bar and the discipline picker. All of it is the shell — it is
   * on screen before anything is drawn, so it cannot be loaded later. What
   * could wait went the other way in the same pass: the creation page, the
   * visibility popover and everything they pull are now on demand.
   *
   * Raised once more, by two kio, for the resolved-number layer: what a total
   * says when one of its terms is unknown. It is a hundred lines and it is in
   * the initial chunk because the calculation adapters are.
   *
   * Raised by one more kio for the complete catalogue snapshot: the equipment
   * shape now describes the performance curves, the rendering and the source
   * of each figure, and that shape is compiled into the validator every import
   * runs. It is the price of a project that opens the same way with the
   * catalogue uninstalled.
   *
   * Raised by one more for the material and assembly catalogues: the sixteen
   * materials and the seven build-ups a new project starts with are data now
   * rather than two lists written out in the application, and a new project is
   * created before anything is drawn. The data is the same size as the code it
   * replaces; what grew is the loader and the gate around it.
   *
   * And one more for the opening catalogue: twelve models of window, door and
   * shutter, which a new project carries because `Opening.definitionId` named
   * an entry and nothing shipped one — so every window was drawn with a
   * transmittance nobody had stated.
   *
   * And a last kio for catalogue discovery: the six loaders find their files
   * instead of importing eight of them by name, which is what makes adding
   * fiches a `git add` rather than an edit to two TypeScript files.
   *
   * And six kio for the first two filling waves. Not the fiches — those are in
   * the catalogue browser, which is loaded on demand and stays there; this is
   * the nomenclature, which the editor holds because the inspector, the
   * workflows and the checks all ask it what a family is. It grew because
   * ninety-three families of water and drainage now state what they are
   * connected by rather than repeating one list per schema, because a hundred
   * and thirty families gained the coarse grouping the interface sorts on, and
   * because seven families of roof covering were declared. The nomenclature is
   * complete at five hundred and twenty-seven; the waves still to come add
   * fiches, and fiches are not loaded here.
   *
   * And back down to 260 once a new project stopped being handed the shelf.
   * The three catalogues were in this payload for one reason: creating a blank
   * project copied all of them into it, and creating a project is something
   * the application must be able to do before anything is loaded. A basket of
   * twenty-two entries replaced them, and taking the catalogue off the barrels
   * of `materials` and `assemblies` took the rest — importing a package for
   * `materialId` used to pull every fiche its tree holds, because the eager
   * glob runs on import and nothing tree-shakes a hundred JSON files away.
   *
   * What this number now protects is worth more than the kilobytes: six waves
   * of filling cost the first payload four hundred bytes, and the seventh will
   * cost none.
   *
   * Raised by ten kio for the graphic charter of the fourteenth audit. The
   * plan is no longer drawn from a table of thirty roles: a rule resolver
   * reads what the scene already said about each object, a second charter
   * states two palettes and the paper widths of a house rather than of a
   * schema, rooms carry a canonical use, openings carry the drawing their
   * family calls for, placed things carry the footprint their fiche declares,
   * and a label is placed where it fits rather than at the average of the
   * corners. All of it is the drawing, and the drawing is what the first visit
   * loads — a plan that appears after a second panel would not be a plan.
   *
   * Two kio of the ten are the eighteen emprises themselves. They are data in
   * `data/symbols`, found by the same discovery as every other catalogue, and
   * they travel with the editor because a bath has to be drawn as a bath
   * before anything else has been asked for.
   *
   * A budget is a decision, not a measurement. This one was taken knowingly.
   *
   * Un kio de plus pour les neuf étapes de création. Le registre remplace les
   * cinq espaces, qui pesaient déjà : ce que la refonte ajoute vraiment est le
   * compte de ce qu'il reste à faire par étape, dérivé du modèle et affiché en
   * permanence dans la barre. Un nombre qui dit « il reste trois choses dans
   * Systèmes » se paie dans le premier chargement, parce que la barre est là
   * dès le premier écran.
   *
   * Et cinq de plus pour la boîte à outils : cinquante-quatre dessins de vingt
   * pixels, plus les entrées qui disent ce qu'on pose. Une colonne de vingt-cinq
   * libellés se lit ligne à ligne ; une grille se balaie, et c'est l'icône qui
   * fait la grille. Aucun de ces octets ne peut attendre — la boîte est le
   * premier panneau du premier écran. Aucune bibliothèque d'icônes n'est
   * installée pour autant : ce sont des `<svg>` en ligne, en `currentColor`,
   * et la plus légère des bibliothèques aurait coûté davantage.
   *
   * Puis un de plus : la barre de vue, l'écran d'affichage unique et la phrase
   * qui dit ce que l'outil attend. Un demi-kio de moins serait revenu à
   * laisser quelqu'un découvrir en se trompant qu'un mur continu se termine
   * par Entrée.
   *
   * Puis deux avec les prédicats de disponibilité : ce que la maison est, lu
   * du modèle, et la raison écrite de chaque outil qui ne sert pas encore. Ces
   * phrases sont la fonction — les abréger reviendrait à griser des boutons en
   * silence, ce qui est précisément la panne qu'on répare.
   *
   * Et un avec le header du plan. Il rend bien plus qu'il ne prend : la coque
   * passe de 153 à 116 px au-dessus du dessin, et la colonne de gauche de
   * vingt-deux boutons à deux.
   *
   * Et deux avec le registre des headers : trente-sept sous-parties au lieu de
   * douze, et cent soixante entrées au lieu de quatre-vingts. Ce sont les
   * boutons eux-mêmes ; le catalogue qu'ils nomment, lui, reste à la demande —
   * un projet neuf l'installe depuis l'assistant de création, qui se charge
   * quand on le demande.
   *
   * Et un avec les étiquettes de surface : ce que les murs enferment, écrit
   * sur le plan. C'est le premier écran, et la question « est-ce que c'est
   * reconnu ? » se pose au premier contour fermé.
   *
   * Et un avec Mesurer, Fusionner et les pans de toiture : trois gestes du
   * plan, donc trois gestes du premier écran.
   *
   * Et un avec ce que le plan écrit tout seul — cotes intérieures et pente
   * des évacuations. C'est le dessin lui-même : il n'y a pas d'endroit plus
   * tôt où le mettre.
   *
   * Et un avec la fermeture des surfaces : l'aire et le périmètre écrits
   * pendant qu'on trace, le premier sommet marqué, l'arête de fermeture, et
   * les deux boutons qui achèvent un contour à la souris. Une parcelle se
   * dessine pour ses mètres carrés ; les lire après l'avoir créée obligeait à
   * créer, lire, annuler, recommencer.
   *
   * Et un avec la grille du modèle. Elle remplace deux lignes de CSS, ce qui
   * est cher — sauf que ces deux lignes peignaient des carreaux de 24 pixels
   * qui ne mesuraient aucune longueur, ne suivaient ni le déplacement ni le
   * zoom, et faisaient de « poser un mur sur la grille » un hasard. Un repère
   * qui ne repère rien ne coûte rien et ne vaut rien.
   *
   * Et deux avec l'éditeur de contour. Un seul jeu de champs — largeur,
   * profondeur, longueur de chaque côté, coordonnées de chaque sommet, aire,
   * périmètre — répond pour la dalle, la toiture, la trémie et la parcelle,
   * et remplace quatre écrans dont deux n'existaient pas : la parcelle se
   * retraçait pour se corriger, et la trémie n'était même pas un objet. Deux
   * kio pour quatre surfaces, c'est le prix d'une seule.
   *
   * Et un avec la rose des vents, les étiquettes de surface, et les entrées
   * qui installent la fiche qu'elles posent. Les deux premières se dessinent
   * sur le plan, donc au premier écran ; la troisième n'y charge rien — le
   * catalogue générique arrive quand on prend l'entrée, et pas avant.
   *
   * Et trois avec le calque de papier et le nombre d'étages. Le premier est
   * la seule façon de commencer une maison sur autre chose qu'une feuille
   * blanche : un cadastre sous le dessin, calé en le regardant. Le second
   * répond à « je fais une maison à deux étages », qui est une phrase qu'on
   * dit **en** dessinant, et qui demandait jusqu'ici de quitter le plan pour
   * empiler des niveaux à la main puis de tout retracer.
   *
   * Et un avec la porte vers la nomenclature. La boîte à outils nomme
   * soixante-dix-neuf familles ; trois cent quatre-vingts se posent, dont deux
   * cent soixante-six ont déjà une fiche. « Autre… » ouvre les autres, filtrées
   * sur le métier de la sous-partie, et le choix installe la fiche **et** prend
   * l'outil avec elle. Ce qui arrive au premier écran est le bouton et sa
   * règle de style : le sélecteur, lui, est chargé quand on l'ouvre — c'est
   * toute la nomenclature, et un plan qui s'ouvre n'a pas à la porter.
   *
   * Et deux avec soixante-treize entrées nommées de plus — la porte-fenêtre,
   * la baie vitrée, le variateur, la sortie de cuisson, la VMC double flux, la
   * fosse toutes eaux, le puits d'infiltration, l'onduleur hybride. Le nombre
   * de familles qu'un bouton nomme passe de soixante-dix-neuf à cent
   * quarante-huit. Ce sont des données, pas du code : chaque entrée est une
   * ligne de registre, et `entry-placement.test.ts` les pose toutes pour de
   * bon. Deux kio pour soixante-treize gestes qui demandaient d'ouvrir la
   * nomenclature.
   *
   * Et un avec `OpeningHost`. Une ouverture pointait un mur par un
   * identifiant nu ; elle dit maintenant **quoi** elle perce, et l'objet
   * `{ kind, id }` s'écrit à chaque endroit qui en pose une. C'est le prix
   * d'une hypothèse retirée du modèle, et c'est le dernier kio qu'on paie
   * ainsi : le suivant devra être financé par le découpage des catalogues en
   * chargement à la demande, et non par un budget qu'on relève.
   *
   * Et quatre avec le format durci. Soixante-treize objets du schéma se
   * ferment, et Ajv émet un contrôle de propriétés pour chacun : le validateur
   * compilé pèse quatre kio de plus, au premier écran parce que `project-io`
   * est importé au chargement.
   *
   * **J'avais écrit que le kio précédent serait le dernier payé ainsi.** Il ne
   * l'est pas, et le dire vaut mieux que de le maquiller : ces quatre kio
   * achètent un format qui refuse `definitonId`, ce qui est un meilleur marché
   * que le précédent. Mais la dette est réelle et elle a un nom : sortir la
   * validation du chargement initial, comme `autosave` en est sorti — un
   * sous-chemin `project-io/validation`, et l'application qui l'appelle au
   * moment où elle ouvre un fichier plutôt qu'au moment où elle démarre. Tant
   * que ce n'est pas fait, aucun budget ne doit plus monter.
   *
   * Et un avec le moteur de toiture — le squelette droit pondéré, qui trouve
   * où les pans se rencontrent sur un contour quelconque. Il monte au premier
   * écran parce que le plan dessine des toitures.
   *
   * **La règle du paragraphe précédent est donc enfreinte, et voici pourquoi
   * la sortie de la validation n'a pas eu lieu ici.** Elle n'est pas un
   * sous-chemin à ajouter, comme `browser` l'était : `scenarios.ts` et
   * `container.ts` importent tous deux `project-io.ts`, qui charge le
   * validateur compilé à la racine du module. Sortir le validateur demande de
   * couper `project-io.ts` en deux — ce qui touche la sérialisation, la
   * lecture et les conteneurs — et mérite son propre changement plutôt que
   * d'être bâclé au passage d'un moteur de toiture. C'est le premier de la
   * dette, et il reste le premier.
   *
   * **Cette dette est payée, et ce nombre baisse de trente et un kio.** Le
   * découpage a eu lieu : `file-io.ts` porte la lecture, l'écriture et la
   * validation d'un fichier, `container.ts` l'archive qui le transporte, et
   * les deux vivent derrière `@house-technical-designer/project-io/files`.
   * Le barillet du paquet ne les réexporte plus, donc rien n'y touche par
   * accident. L'application les charge à trois endroits, et chacun est un
   * geste : enregistrer, exporter, importer. La sauvegarde locale les charge
   * elle aussi à la demande — ses deux usages sont dans des fonctions `async`,
   * et une reprise de session attend déjà IndexedDB.
   *
   * Ce qui a été mesuré : le premier écran passe de 304 à 273 kio, et le
   * validateur compilé se retrouve dans un fichier à lui, chargé le jour où
   * quelqu'un ouvre un projet. Personne ne le télécharge pour regarder un
   * plan.
   *
   * Ce chiffre est donc un plafond de nouveau serré, à cinq kio du réel. La
   * règle reprend sa valeur : le prochain kio du premier écran devra être
   * financé par ce qui en sort, et non par ce budget.
   *
   * **Et il l'a été : les dix-sept moteurs de calcul en sortent, et ce nombre
   * baisse de vingt-sept kio de plus.** Ils n'auraient jamais dû y être. Le
   * fichier qui les nomme — `module-registry.ts` — promettait dans son en-tête
   * de n'importer rien, « pour que nommer un module coûte quelques centaines
   * d'octets plutôt que dix-sept moteurs de calcul ». La promesse était tenue
   * par le fichier et défaite par le paquet : le barillet le réexportait à
   * côté des moteurs, et l'écran des réglages importait le barillet pour lire
   * un libellé et une méthode. Thermique, hydraulique, électrique, acoustique
   * arrivaient donc au premier écran de quelqu'un qui n'ouvre jamais l'onglet
   * des calculs.
   *
   * Le sous-chemin `calculation-adapters/registry` ne contient que des noms —
   * identifiant, libellé, méthode, version — et `registry-only.test.ts` tient
   * les deux moitiés de la promesse : le fichier reste sans dépendance, et ce
   * qu'il déclare est ce que les moteurs déclarent.
   *
   * Le plafond redescend donc à 254, de nouveau à quelques kio du réel.
   */
  initialGzipBytes: 254 * 1024,
  /**
   * Everything the build produces, gzipped.
   *
   * Raised with the catalogues of the thirteenth audit: the materials, the
   * build-ups and the menuiseries are data now rather than three lists written
   * out in code, and data that a gate reads costs a little more than code
   * nobody checked.
   *
   * Raised again for the mass-fill gate: discovery in place of eight
   * hand-written imports, and every material and build-up carrying the
   * catalogue reference it came from.
   *
   * Raised by twelve kio for the first two filling waves: two hundred and
   * three new fiches — matériaux, compositions, menuiseries, mobilier, and the
   * ninety-three familles of water and drainage. Most of that weight is in the
   * catalogue browser's chunk, which is where it belongs; what it buys is that
   * a family offered to somebody has something behind it.
   *
   * Raised by twenty-four kio for waves three to six: two hundred and forty
   * fiches more — heating, ventilation, electricity, lighting, solar, storage,
   * flues, data, safety, the site — and seventeen network products. Every kio
   * of it landed on demand: the initial payload moved by less than one, which
   * is the whole point of the split and the reason this budget is counted in
   * two numbers rather than one.
   *
   * And two more when the catalogues left the first payload: what leaves it
   * has to land somewhere, and it landed on demand. That is the trade this
   * budget exists to make visible — the total went up by two kilobytes, the
   * download a first visit pays for went down by seven.
   *
   * And four more for the pickers: choosing a fiche instead of importing a
   * catalogue is a search box, a list of rows and a menuiseries panel that had
   * no home. All three land on demand, in the workspace that asks.
   *
   * And three more for the reference house, which is made of catalogue fiches
   * now: nineteen equipment fiches and three menuiseries with their ports,
   * their clearances, their sources and their performance curves, and thirty
   * and three objects standing somewhere in the building instead of nine, and
   * an envelope of five catalogue build-ups made of eleven catalogue materials
   * in place of three compositions written for that file alone. It is a
   * fixture, and it travels with the application because the demonstration
   * project is the application's front door. What it buys is that every module
   * is exercised by a house made of what a user can actually choose — the day
   * it was rebuilt from fiches, three modules stopped finding anything, and
   * the day its envelope was, the takeoff went looking for prices nobody had
   * declared. That is exactly the failure a demonstration project exists to
   * catch.
   *
   * And two more for the last of the contract gaps: twenty-one fiches for the
   * families the assembly registry could not describe — a column has a
   * section, a ridge has a length — twelve flue products so that a straight
   * section stops existing in two registries at once, and the retirement
   * reasons of the families that left service. A catalogue that only grows is
   * one nobody can correct; what a retirement costs is the sentence saying
   * where to go instead, and it is worth its bytes.
   *
   * And one more so the takeoff counts the floors and the roof. It read the
   * walls and nothing else: the ground slab, the intermediate floor and both
   * roof planes never reached the bill of materials, the cost total or the
   * carbon total, and the total did not say it was missing half the building —
   * it gave a figure.
   *
   * And ten more with the initial payload, for the same reason and by the same
   * amount: what the fourteenth audit added to the drawing is the drawing, so
   * none of it could be moved behind a lazy boundary.
   *
   * Et un de plus avec les neuf étapes : le registre des étapes et le compte
   * de ce qu'il reste, tous deux dans la coque.
   *
   * Et quatre avec la boîte à outils, pour la même raison et par le même
   * montant : les icônes sont le premier panneau du premier écran, donc rien
   * d'elles ne pouvait passer derrière une frontière paresseuse.
   *
   * Et un avec la barre de vue et l'instruction de l'outil. Le panneau
   * d'affichage, lui, se charge encore à la demande : on ne l'ouvre pas pour
   * dessiner un mur.
   *
   * Et un avec les prédicats de disponibilité : l'état dérivé et les raisons
   * partent dans le même chargement que la boîte à outils, faute de quoi la
   * première grille de l'écran serait grise sans un mot pendant qu'un morceau
   * arrive.
   *
   * Et un avec le header du plan : la rangée des sous-parties, la rangée
   * d'outils et le bandeau d'options sont le premier écran, et le premier
   * écran ne se charge pas en deux fois.
   *
   * Et dix avec le registre des headers et la maison de démonstration, qui
   * tient désormais les trente-quatre fiches supplémentaires que ses boutons
   * savent poser — un bouton qui ne peut rien poser est une promesse, et une
   * maison de démonstration qui n'en tient aucune est une démonstration de
   * boutons absents.
   *
   * Et un avec la barre d'état du §1 : le pas de grille en centimètres,
   * l'orthogonal sorti des réglages, le mode de cotation et l'échelle en
   * rapport. Sept cellules qu'on lit sans arrêt valent mieux que cinq qu'il
   * faut traduire.
   *
   * Et un avec les types de maison. Cinq listes de niveaux et deux fonctions
   * qui les lisent dans les deux sens : un kio pour ne plus commencer un
   * projet en empilant des étages à la main.
   *
   * Et un avec la vue d'ensemble des études, qui se charge avec l'écran
   * qu'elle ouvre — « où en est ma maison » est une autre question que
   * « qu'est-ce qui cloche », et elle méritait sa page.
   *
   * Et un avec ce que le plan écrit tout seul : les cotes intérieures et la
   * pente des évacuations. Une évacuation horizontale est une évacuation qui
   * ne s'écoule pas, et c'est la seule chose qu'un plan doit crier.
   *
   * Et un avec la fermeture des surfaces, un avec la grille du modèle et deux
   * avec l'éditeur de contour, comptés au chargement initial ci-dessus : ils
   * vivent dans le plan, donc dans le premier écran.
   *
   * Et un avec le panneau « Ajouter » et la rangée des niveaux. Le panneau ne
   * tient aucune liste : il appelle `toolboxFor` comme le header, et dessine
   * ses entrées avec le même `EntryButton` — ce qu'il coûte, c'est un
   * composant et une grille. La colonne de gauche montre enfin ce qu'on peut
   * poser plutôt que ce qui est déjà posé, et l'étage courant reste à un clic.
   *
   * Et deux avec le sélecteur de famille, chargés à l'ouverture et jamais
   * avant. Ils remplacent six gestes par deux pour deux cent soixante-six
   * familles : c'est le meilleur rapport de tout ce tableau.
   *
   * Et un avec les soixante-treize entrées nommées, comptées au chargement
   * initial ci-dessus : le registre vit dans le premier écran.
   *
   * Et un avec la sortie de la validation. C'est exactement l'échange que ce
   * budget existe pour rendre visible, et il se lit en une ligne : le total
   * monte d'un kio, le premier écran descend de trente et un. Ce qui quitte
   * le premier téléchargement doit bien atterrir quelque part, avec le peu de
   * colle qu'un fichier de plus demande ; il atterrit à la demande.
   *
   * Et un avec les noues. Le squelette droit sait désormais scinder son front
   * sur un sommet rentrant, ce qui donne à un L, un U, un T et une croix leurs
   * pans, leurs noues et leur faîtage — les formes de maison qui viennent
   * juste après le rectangle, et qui jusque-là ne comptaient nulle part. Il
   * monte au premier écran parce que le plan dessine des toitures, et le
   * premier écran tient quand même dans son plafond : le kio se voit ici et
   * pas là-haut.
   *
   * Et deux avec les fenêtres de toit. Une ouverture dit maintenant **comment**
   * elle se repère et non seulement ce qu'elle perce : le long d'un mur avec
   * son allège, ou dans le plan du pan, le long de l'égout et en remontant le
   * rampant. Le second repère demande la géométrie du pan — trouver son égout
   * depuis l'azimut, raccourcir la montée de la pente, vérifier que les quatre
   * coins tiennent dans le pan — et le plan les dessine. Deux kio pour une
   * famille d'ouvertures que la nomenclature nommait depuis toujours et que le
   * modèle ne savait pas poser.
   *
   * Et un avec l'outil qui les pose. « Ouverture de toit » existait déjà dans
   * la boîte : elle prenait l'outil qui perce un mur, demandait une toiture
   * pour s'activer, et posait la fenêtre dans le mur le plus proche du clic —
   * on visait le toit, la fenêtre arrivait au rez-de-chaussée. Le kio paie un
   * vrai outil, sa commande, et le clic converti dans le repère du pan.
   *
   * Et un avec les circuits qui se ramifient. Le moteur électrique ne savait
   * additionner qu'une guirlande, et faisait passer le courant total du
   * circuit dans chacun de ses tronçons : tout circuit de maison — où l'on
   * tire une dérivation par pièce — ressortait sans aucune chute de tension.
   * Il lit maintenant l'arbre que le réseau déclare, fait porter à chaque
   * tronçon le courant des seules charges qu'il alimente, et rend la chute de
   * la charge la plus défavorisée. Le kio arrive à la demande, avec les dix-
   * sept moteurs de calcul, et pas au premier écran.
   *
   * Et le total **baisse** d'un kio en sortant les moteurs du premier écran :
   * réunis dans un seul fichier chargé à la demande, ils cessent d'être
   * dupliqués entre la coque et le morceau des calculs. C'est rare — la
   * plupart des sorties coûtent un peu de colle — et c'est ce qui arrive quand
   * ce qui sortait était une duplication plutôt qu'un poids propre.
   *
   * Et un demi-kio pour une chute d'évacuation et un niveau de cuve. Le moteur
   * refusait un tuyau vertical — « pente indéfinie » — ce qui mettait en
   * défaut le réseau de toute maison à étage, la maison de démonstration
   * comprise ; et le volume du premier jour d'une cuve d'eau de pluie n'avait
   * aucun endroit où se dire, parce qu'il était cherché sur la fiche du
   * fabricant alors que c'est une décision de celui qui simule.
   */
  totalGzipBytes: 491 * 1024,
};

/** The assets an HTML page loads before anything runs. */
export function initialReferences(html) {
  const references = new Set();
  const pattern = /<(?:script|link)\b[^>]*?\b(?:src|href)="\.?\/?([^"]+)"/gu;
  for (const [, reference] of html.matchAll(pattern)) {
    if (reference.startsWith('data:') || reference.startsWith('#')) continue;
    references.add(reference.replace(/^\.\//u, ''));
  }
  return [...references];
}

async function gzipBytes(file) {
  return gzipSync(await readFile(file), { level: 9 }).byteLength;
}

async function main() {
  const dist = process.argv[2] ?? 'apps/web/dist';
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const referenced = new Set(initialReferences(html));

  const files = (await readdir(path.join(dist, 'assets'))).map((name) =>
    path.posix.join('assets', name),
  );
  let initial = gzipSync(Buffer.from(html), { level: 9 }).byteLength;
  let total = initial;
  const deferred = [];
  for (const file of files) {
    const size = await gzipBytes(path.join(dist, file));
    total += size;
    if (referenced.has(file)) initial += size;
    else deferred.push({ file, size });
  }

  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kio`;
  console.log(`Chargement initial : ${kb(initial)} compressé`);
  console.log(`Total produit      : ${kb(total)} compressé`);
  console.log(
    `À la demande       : ${deferred.length} fichier(s), ${kb(
      deferred.reduce((sum, entry) => sum + entry.size, 0),
    )}`,
  );

  const failures = [];
  if (initial > BUDGETS.initialGzipBytes)
    failures.push(
      `Le chargement initial fait ${kb(initial)} ; le budget est de ${kb(BUDGETS.initialGzipBytes)}.`,
    );
  if (total > BUDGETS.totalGzipBytes)
    failures.push(
      `Le total fait ${kb(total)} ; le budget est de ${kb(BUDGETS.totalGzipBytes)}.`,
    );
  if (failures.length > 0) {
    console.error('\nBudget dépassé :');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nSoit une dépendance a grossi, soit du code chargé à la demande est',
    );
    console.error(
      'revenu dans le chargement initial. Décider, puis ajuster le budget.',
    );
    process.exit(1);
  }
  console.log('\nBudget tenu.');
}

if (process.argv[1]?.endsWith('check-bundle-budget.mjs')) await main();
