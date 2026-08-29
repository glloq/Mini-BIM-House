import { expect, test, type Page } from '@playwright/test';

import { fileAction, loadDemoProject } from './support/file-menu.js';
import {
  countGestures,
  expectGestures,
  mark,
  startCounting,
} from './support/gestures.js';
import {
  openDestination,
  openStage,
  workspaceReady,
} from './support/navigation.js';
import { openModelTree, openTools } from './support/panels.js';
import { openSection, toolButton } from './support/tools.js';

/**
 * Ce que coûtent les intentions les plus fréquentes.
 *
 * Le reste de la suite dit qu'une chose est **possible**. Aucun test ne disait
 * ce qu'elle **coûte**, et c'est pourtant là que l'ergonomie se perd : poser
 * une porte reste « possible » quand il faut sept gestes pour y arriver, et
 * une suite entièrement verte ne s'en aperçoit pas. Une régression
 * d'ergonomie n'échoue nulle part — c'est ce qui la rend si facile à
 * accumuler.
 *
 * Chaque test suit le **chemin direct**, celui de quelqu'un qui sait où va
 * l'outil, et plafonne le nombre de gestes réellement reçus par la page.
 * Ajouter une confirmation, un panneau à rouvrir, un onglet à reprendre fera
 * échouer l'intention concernée, avec le relevé geste par geste.
 *
 * Les budgets sont relevés sur l'écran tel qu'il est, pas souhaités. Les
 * baisser est le travail ; les monter est une décision qu'on écrit.
 */

const CANVAS = '.plan-canvas';

async function fresh(page: Page): Promise<void> {
  await countGestures(page);
  await page.goto('/');
  await workspaceReady(page);
  await startCounting(page);
}

async function demo(page: Page): Promise<void> {
  await countGestures(page);
  await page.goto('/');
  await loadDemoProject(page);
  await expect(page.locator('[id^="wall:"]').first()).toBeVisible();
  await startCounting(page);
}

/** Un point du plan, en fractions, pour ne pas dépendre de sa taille. */
async function at(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = (await page.locator(CANVAS).boundingBox())!;
  return { x: box.width * x, y: box.height * y };
}

test('tracer un mur dans un projet neuf', async ({ page }) => {
  await fresh(page);

  // L'espace, l'outil, le départ, l'extrémité. Il n'y a rien d'autre à faire,
  // et rien d'autre ne doit s'intercaler : ni assistant, ni niveau à créer,
  // ni panneau à reprendre.
  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Murs');
  await toolButton(page, 'Mur').click();
  const canvas = page.locator(CANVAS);
  await canvas.click({ position: await at(page, 0.3, 0.4) });
  await canvas.click({ position: await at(page, 0.7, 0.4) });

  await expect(page.locator('[id^="wall:"]')).toHaveCount(1);
  await expectGestures(page, 'tracer un mur dans un projet neuf', 4);
});

test('revenir à une sous-partie déjà ouverte ne se paie pas deux fois', async ({
  page,
}) => {
  /*
   * L'enchaînement le plus ordinaire du dessin : un mur, une porte dans ce
   * mur, un autre mur. Onze gestes, et l'un d'eux ne devrait pas exister.
   *
   * Cinq sont des actions sur le plan, trois sont les outils qu'on prend, un
   * est l'espace. Le onzième rouvre « Murs », que l'ouverture d'« Ouvertures »
   * avait refermé : le sommaire de la colonne est un accordéon, et revenir à
   * une sous-partie où l'on travaillait coûte un clic pour défaire ce que le
   * précédent avait défait.
   *
   * Essayé, mesuré, défait : laisser plusieurs replis ouverts ramène bien le
   * compte à dix, et fait paraître ensemble des entrées qui portent le même
   * nom dans des sous-parties différentes — deux boutons « Tracer un
   * tronçon », l'un pour une canalisation, l'autre pour un circuit. À l'œil on
   * les départage par le titre sous lequel ils sont rangés ; pour qui écoute
   * la page, ce sont deux boutons identiques. Un geste gagné contre un écran
   * ambigu n'est pas un bon échange.
   *
   * Le budget dit donc onze et non dix, et il dit pourquoi. Le jour où les
   * entrées de la boîte porteront des noms qui se distinguent, il descendra —
   * et c'est ce test qui le rappellera.
   */
  await fresh(page);
  const canvas = page.locator(CANVAS);

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Murs');
  await toolButton(page, 'Mur').click();
  await canvas.click({ position: await at(page, 0.3, 0.4) });
  await canvas.click({ position: await at(page, 0.7, 0.4) });

  await openTools(page);
  await openSection(page, 'Ouvertures');
  await toolButton(page, 'Porte').click();
  await page.locator('[id^="wall:"]').first().click({ force: true });

  await openTools(page);
  await openSection(page, 'Murs');
  await toolButton(page, 'Mur').click();
  await canvas.click({ position: await at(page, 0.3, 0.6) });
  await canvas.click({ position: await at(page, 0.7, 0.6) });

  await expect(page.locator('[id^="wall:"]')).toHaveCount(2);
  await expect(page.locator('[id^="opening:"]')).toHaveCount(1);
  await expectGestures(page, 'un mur, une porte, puis un autre mur', 11);
});

test('poser une porte dans un mur existant', async ({ page }) => {
  await demo(page);
  const before = await page.locator('[id^="opening:"]').count();

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Ouvertures');
  await toolButton(page, 'Porte').click();
  // Une porte se pose **sur** un mur : on désigne le mur, pas un point du vide.
  await page.locator('[id^="wall:"]').first().click({ force: true });

  await expect(page.locator('[id^="opening:"]')).toHaveCount(before + 1);
  await expectGestures(page, 'poser une porte dans un mur existant', 4);
});

test('corriger la longueur d’un mur', async ({ page }) => {
  await demo(page);

  /*
   * Désigner, puis dire la valeur. Deux gestes.
   *
   * La colonne passe aux propriétés d'elle-même : c'est ce qui fait tenir
   * cette intention en deux gestes plutôt qu'en quatre, et c'est exactement ce
   * qu'un budget protège — le jour où il faudra rouvrir un onglet, ce test le
   * dira.
   */
  await page.locator('[id^="wall:"]').first().click({ force: true });
  // La longueur et non l'épaisseur : l'épaisseur d'un mur vient de son
  // assemblage et se lit, elle ne se saisit pas. C'est une décision du modèle,
  // pas un manque, et un test d'ergonomie n'a pas à la contester.
  // Deux champs disent la longueur : celui de l'inspecteur et celui que le
  // plan pose à côté de la sélection. On mesure le premier — c'est là qu'on
  // corrige ce qui existe ; l'autre sert à poser.
  const length = page.locator('#inspector-lengthMm');
  await length.fill('7500');
  await length.press('Enter');

  await expect(length).toHaveValue('7500');
  await expectGestures(page, 'corriger la longueur d’un mur', 2);
});

test('tracer une parcelle', async ({ page }) => {
  await fresh(page);

  await openStage(page, 'Terrain');
  await openTools(page);
  await toolButton(page, 'Parcelle').click();
  const canvas = page.locator(CANVAS);
  for (const [x, y] of [
    [0.25, 0.35],
    [0.7, 0.35],
    [0.7, 0.75],
    [0.25, 0.75],
  ] as const)
    await canvas.click({ position: await at(page, x, y) });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();

  await expect(page.locator('[id="site:parcel"]')).toHaveCount(1);
  // Quatre sommets et la fermeture sont irréductibles ; l'espace et l'outil
  // sont les deux seuls gestes de navigation qu'on accepte devant.
  await expectGestures(page, 'tracer une parcelle à quatre coins', 7);
});

test('poser un meuble dans une pièce', async ({ page }) => {
  await demo(page);
  const before = await page.locator('[id^="component:"]').count();

  // L'aménagement ne se range pas en sous-parties : ce qu'on pose est nommé
  // par ce que c'est, et un lit se prend directement.
  await openStage(page, 'Aménagement');
  await openTools(page);
  await toolButton(page, 'Lit').click();
  await page.locator(CANVAS).click({ position: await at(page, 0.4, 0.45) });

  await expect(page.locator('[id^="component:"]')).toHaveCount(before + 1);
  await expectGestures(page, 'poser un meuble dans une pièce', 3);
});

/* ------------------------------------------------------------------------ *
 * Le reste de ce qu'un projet de maison demande.
 *
 * Les cinq intentions ci-dessus sont les gestes du dessin. Une maison ne se
 * fait pas qu'en traçant : on la commence, on l'empile, on la nomme, on la
 * perce, on la range, on la lit et on la rend. Chacune de ces intentions-là a
 * son budget, relevé sur l'écran tel qu'il est, et le relevé dit où il part.
 * ------------------------------------------------------------------------ */

/**
 * Les identifiants des objets d'une famille, tels que le dessin les porte.
 *
 * Un composant n'est pas un trait : un WC est dessiné en trois morceaux, qui
 * portent tous son identifiant suivi d'un rang. Compter les éléments du plan
 * comptait donc trois WC pour un WC posé, et le test annonçait un échec là où
 * l'application avait raison. Ce qu'on veut savoir est combien d'**objets**
 * le niveau porte, et c'est l'identifiant qui le dit.
 */
async function objectsOf(
  page: Page,
  prefix: string,
): Promise<readonly string[]> {
  return await page
    .locator(`[id^="${prefix}"]`)
    .evaluateAll((nodes) => [
      ...new Set(
        nodes.map((node) =>
          (node.getAttribute('id') ?? '').replace(/:\d+$/u, ''),
        ),
      ),
    ]);
}

test('créer un projet neuf et arriver au plan', async ({ page }) => {
  await fresh(page);

  // Le menu, l'entrée, le bouton qui crée. L'assistant a quatre étapes et
  // aucune n'est obligatoire : c'est ce qui garde cette intention courte.
  await fileAction(page, 'Nouveau projet');
  await mark(page, 'l’assistant de création est ouvert');
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await workspaceReady(page);
  await mark(page, 'le projet existe — mais on est sur la fiche « Projet »');

  /*
   * Le quatrième geste est celui qu'on ne devrait pas payer.
   *
   * Créer un projet dépose sur l'espace « Projet », c'est-à-dire sur un
   * formulaire d'identité, et le plan est ailleurs. Or personne ne crée un
   * projet pour remplir sa fiche : on le crée pour dessiner. Ce geste est
   * relevé ici parce qu'il est réel, et non parce qu'il est normal.
   */
  await openStage(page, 'Bâtiment');

  await expect(page.locator(CANVAS)).toBeVisible();
  await expectGestures(page, 'créer un projet neuf et arriver au plan', 4);
});

test('ajouter un niveau', async ({ page }) => {
  await demo(page);

  /*
   * Le chemin mesuré n'est pas le plus court affiché, et c'est un constat.
   *
   * L'espace du bâtiment offre un « + » sous la rangée des niveaux, qui tient
   * l'intention en deux gestes. Il est refusé sur cette maison : il duplique
   * le rez-de-chaussée, la copie emporte ce que le niveau porte, et la
   * frontière d'édition répond « Cet objet appartient à Systèmes ». Un bouton
   * qui refuse n'est pas un chemin ; celui qui marche est la table des
   * niveaux, et c'est lui qu'on plafonne.
   */
  await openDestination(page, 'Niveaux et pièces');
  await mark(page, 'la table des niveaux est ouverte');
  await page.getByRole('button', { name: 'Ajouter un niveau' }).click();

  await expect(page.getByLabel('Nom du niveau Niveau 3')).toHaveValue(
    'Niveau 3',
  );
  await expectGestures(page, 'ajouter un niveau', 3);
});

test('tracer une pièce et la nommer', async ({ page }) => {
  await fresh(page);

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await toolButton(page, 'Murs rectangle').click();
  const canvas = page.locator(CANVAS);
  await canvas.click({ position: await at(page, 0.28, 0.36) });
  await canvas.click({ position: await at(page, 0.68, 0.72) });
  await mark(page, 'quatre murs, un contour fermé');

  // Le contour fermé porte le geste qui en fait une pièce, là où on le
  // regarde : c'est plus court que de reprendre la sous-partie « Pièces »
  // puis l'outil « Pièce », et c'est donc le chemin direct.
  await page.getByRole('button', { name: '+ Créer pièce' }).first().click();
  await expect(page.locator('[data-role="SPACE_FILL"]').first()).toBeVisible();
  await mark(page, 'la pièce existe, et s’appelle « Pièce »');

  /*
   * Un geste pour le nom, et c'est le bon chiffre.
   *
   * Créer la pièce la désigne et rend la main à la Sélection : la colonne
   * passe aux propriétés d'elle-même, et nommer ce qu'on vient de faire est
   * la suite du même mouvement. Reprendre l'outil puis viser la pièce coûtait
   * deux gestes pour revenir sur un objet qu'on n'avait pas quitté des yeux.
   */
  const name = page.locator('#inspector-name');
  await name.fill('Séjour');
  await name.press('Enter');

  await expect(name).toHaveValue('Séjour');
  await expectGestures(page, 'tracer une pièce et la nommer', 6);
});

test('percer une fenêtre, puis lui choisir une menuiserie', async ({
  page,
}) => {
  await demo(page);
  const before = await objectsOf(page, 'opening:');

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Ouvertures');
  await toolButton(page, 'Fenêtre').click();
  await page.locator('[id^="wall:"]').first().click({ force: true });
  await expect(page.locator('[id^="opening:"]')).toHaveCount(before.length + 1);
  await mark(page, 'la fenêtre est percée, désignée, et déjà menuisée');

  /*
   * Poser désigne, et poser renseigne.
   *
   * Une fenêtre posée n'avait pas de modèle, et c'est ce qui porte sa
   * transmission thermique : toute fenêtre dessinée était une inconnue du
   * bilan tant que personne n'était revenu la désigner — ce qui coûtait deux
   * gestes, reprendre la Sélection puis viser l'ouverture. L'outil pose
   * maintenant la première menuiserie du catalogue qui convient à ce qu'il
   * perce, et la baie est désignée en naissant. En choisir une autre reste un
   * geste, et un seul.
   */
  /*
   * Un geste pour ouvrir les propriétés, un pour changer de modèle.
   *
   * La colonne garde les outils tant qu'un outil est en main : on vient de
   * percer une fenêtre, on va probablement en percer une autre, et lui
   * remplacer la boîte par une fiche coûterait un geste à chaque ouverture
   * suivante. La baie est désignée pour autant — ses poignées sont là, ses
   * actions aussi — et ses propriétés sont à un clic.
   */
  await page
    .locator('#workspace-sidebar')
    .getByRole('button', { name: 'Propriétés', exact: true })
    .click();
  const model = page.locator('#inspector-definitionId');
  await expect(model).not.toHaveValue('');
  await model.selectOption({ index: 1 });

  await expect(model).not.toHaveValue('');
  await expectGestures(
    page,
    'percer une fenêtre, puis lui choisir une menuiserie',
    6,
  );
});

test('poser un WC', async ({ page }) => {
  await demo(page);
  const before = await objectsOf(page, 'component:');

  await openStage(page, 'Aménagement');
  await openTools(page);
  await openSection(page, 'Salle de bain');
  await toolButton(page, 'WC').click();
  await page.locator(CANVAS).click({ position: await at(page, 0.45, 0.5) });

  expect((await objectsOf(page, 'component:')).length).toBe(before.length + 1);
  await expectGestures(page, 'poser un WC', 4);
});

test('poser ce que la sous-partie ne nomme pas, par la nomenclature', async ({
  page,
}) => {
  await demo(page);
  const before = await objectsOf(page, 'component:');

  /*
   * « Autre… » est la porte vers les cinq cents familles, et le budget dit ce
   * qu'elle coûte à franchir.
   *
   * Le geste surprise était le filtre de métier. La sous-partie « Salle de
   * bain » est rangée dans le Mobilier — c'est là qu'on la meuble — et la
   * nomenclature s'ouvrait donc sur dix familles de meubles, où un bidet
   * n'est pas : il est en Plomberie. Chercher « bidet » dans cet écran ne
   * rendait rien du tout, et il fallait d'abord élargir le métier à la main
   * pour que la recherche réponde. Une porte qui s'ouvrait à côté de la pièce
   * qu'on demandait.
   *
   * Elle s'ouvre maintenant sur tous les métiers que la sous-partie sert —
   * plomberie **et** mobilier — et le geste a disparu du budget.
   */
  await openStage(page, 'Aménagement');
  await openTools(page);
  await openSection(page, 'Salle de bain');
  // Chaque « Autre… » dit de quelle sous-partie il ouvre le reste.
  await page.getByRole('button', { name: 'Autre… — Salle de bain' }).click();
  const picker = page.getByRole('dialog', { name: 'Depuis la nomenclature' });
  await mark(page, 'la nomenclature est ouverte — sur ce que la pièce pose');

  await picker.getByLabel('Rechercher').fill('bidet');
  await picker.locator('.catalog-row').first().click();
  await picker.getByRole('button', { name: 'Poser sur le plan' }).click();
  await mark(page, 'la fiche est installée, l’outil tient le bidet');

  await page.locator(CANVAS).click({ position: await at(page, 0.45, 0.5) });

  expect((await objectsOf(page, 'component:')).length).toBe(before.length + 1);
  await expectGestures(
    page,
    'poser ce que la sous-partie ne nomme pas, par la nomenclature',
    6,
  );
});

test('tracer une dalle', async ({ page }) => {
  await demo(page);
  const slabs = page.locator('[id^="slab:"]');
  const before = await slabs.count();

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Dalles');
  await toolButton(page, 'Dalle libre').click();
  const canvas = page.locator(CANVAS);
  for (const [x, y] of [
    [0.24, 0.34],
    [0.68, 0.34],
    [0.68, 0.72],
    [0.24, 0.72],
  ] as const)
    await canvas.click({ position: await at(page, x, y) });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();

  await expect(slabs).toHaveCount(before + 1);
  // Quatre sommets et la fermeture sont irréductibles ; ce qui précède est de
  // la navigation, et c'est là que ce budget se gagnerait.
  await expectGestures(page, 'tracer une dalle à quatre coins', 8);
});

test('percer une trémie dans une dalle', async ({ page }) => {
  await demo(page);

  // La dalle est la mise en place : on la paie, puis on remet le compteur à
  // zéro et on mesure le percement, qui est l'intention.
  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Dalles');
  await toolButton(page, 'Dalle libre').click();
  const canvas = page.locator(CANVAS);
  for (const [x, y] of [
    [0.24, 0.34],
    [0.68, 0.34],
    [0.68, 0.72],
    [0.24, 0.72],
  ] as const)
    await canvas.click({ position: await at(page, x, y) });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();
  await startCounting(page);

  /*
   * Fermer une dalle la désigne — c'est ce que fait la colonne — et reprendre
   * un outil demande donc de redire qu'on vient poser. Ce premier geste est
   * le prix de la bascule, pas celui du percement.
   */
  await openTools(page);
  await toolButton(page, 'Trémie').click();
  for (const [x, y] of [
    [0.34, 0.44],
    [0.5, 0.44],
    [0.5, 0.62],
    [0.34, 0.62],
  ] as const)
    await canvas.click({ position: await at(page, x, y) });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();

  await expect(page.locator('.inspector-subject')).toContainText('Trémie');
  await expectGestures(page, 'percer une trémie dans une dalle', 7);
});

test('poser un escalier entre deux niveaux', async ({ page }) => {
  await demo(page);

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Escalier');
  await toolButton(page, 'Droit').click();
  const canvas = page.locator(CANVAS);
  await canvas.click({ position: await at(page, 0.35, 0.45) });
  await canvas.click({ position: await at(page, 0.55, 0.45) });
  // La ligne de foulée est ouverte : elle accepte autant de points qu'il en
  // faut, et c'est Entrée qui dit qu'elle est finie.
  await page.keyboard.press('Enter');

  await expect(page.locator('[id^="stair:"]')).toHaveCount(2);
  await expectGestures(page, 'poser un escalier entre deux niveaux', 6);
});

test('créer un réseau', async ({ page }) => {
  await fresh(page);

  await openDestination(page, 'Réseaux');
  await mark(page, 'la table des réseaux est ouverte');
  await page.getByLabel('Discipline').selectOption('HEATING');
  await page.getByRole('button', { name: 'Créer le réseau' }).click();

  await expect(page.locator('.network-layout')).toContainText('Chauffage');
  await expectGestures(page, 'créer un réseau', 4);
});

test('aligner trois objets', async ({ page }) => {
  await demo(page);

  // Trois chaises sont la mise en place : ce qu'on mesure est le rangement,
  // pas la pose.
  await openStage(page, 'Aménagement');
  await openTools(page);
  await toolButton(page, 'Chaise').click();
  const canvas = page.locator(CANVAS);
  const spots = [
    [0.24, 0.28],
    [0.5, 0.28],
    [0.76, 0.28],
  ] as const;
  for (const [x, y] of spots)
    await canvas.click({ position: await at(page, x, y) });
  await startCounting(page);

  await toolButton(page, 'Sélection').click();
  for (const [index, [x, y]] of spots.entries())
    await canvas.click({
      position: await at(page, x, y),
      ...(index === 0 ? {} : { modifiers: ['ControlOrMeta' as const] }),
    });
  await mark(page, 'les trois objets sont désignés');

  /*
   * Les huit rangements vont ensemble et sont repliés ensemble : la barre
   * montre les quatre gestes de la famille désignée et range les alignements
   * derrière un « … ». Les atteindre demande donc de déplier, et ce dépliage
   * est un geste que le budget compte.
   */
  await page.getByRole('button', { name: /^… \(/u }).click();
  await page.getByRole('button', { name: 'Aligner à gauche' }).click();

  await expect(page.getByRole('status')).toContainText('Aligner à gauche');
  await expectGestures(page, 'aligner trois objets', 6);
});

test('dupliquer un mur', async ({ page }) => {
  await demo(page);
  const walls = page.locator('[id^="wall:"]');
  const before = await walls.count();

  await page.locator('[id^="wall:"]').first().click({ force: true });
  await mark(page, 'le mur est désigné');

  /*
   * Le geste du milieu est celui qui se discute.
   *
   * La barre ne montre que les quelques actions qui comptent pour la famille
   * désignée, et pour un mur ce sont celles du tracé — décaler, scinder,
   * changer la face de référence. Dupliquer part donc derrière le « … », et
   * copier un mur coûte un geste de plus que copier un meuble, où la même
   * action est sous la main. Ce n'est pas un oubli, c'est un classement : le
   * budget est là pour qu'on sache ce que ce classement coûte, et pour
   * qu'on le révise en connaissance de cause.
   */
  await page.getByRole('button', { name: /^… \(/u }).click();
  await page.getByRole('button', { name: /^Dupliquer/u }).click();

  await expect(walls).toHaveCount(before + 1);
  await expectGestures(page, 'dupliquer un mur', 3);
});

test('annuler, puis refaire', async ({ page }) => {
  await fresh(page);

  // Le mur est la mise en place : ce qu'on mesure est le repentir, pas le
  // tracé.
  await openStage(page, 'Bâtiment');
  await openTools(page);
  await toolButton(page, 'Mur').click();
  const canvas = page.locator(CANVAS);
  await canvas.click({ position: await at(page, 0.3, 0.4) });
  await canvas.click({ position: await at(page, 0.7, 0.4) });
  const walls = page.locator('[id^="wall:"]');
  await expect(walls).toHaveCount(1);
  await startCounting(page);

  // Les deux boutons sont dans la barre haute, en permanence : se reprendre
  // ne demande ni clavier ni menu, et c'est ce que ce budget fige.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(0);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();

  await expect(walls).toHaveCount(1);
  await expectGestures(page, 'annuler, puis refaire', 2);
});

test('retrouver un objet par l’arborescence', async ({ page }) => {
  await demo(page);

  await openModelTree(page);
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  await tree.locator('summary').filter({ hasText: 'Murs' }).click();
  await tree.getByRole('button', { name: 'wall-south', exact: true }).click();

  // Retrouver un objet, c'est le voir désigné : l'arborescence ouvre ses
  // propriétés à côté d'elle plutôt que dessous.
  await expect(page.locator('.inspector-subject')).toContainText('wall-south');
  await expectGestures(page, 'retrouver un objet par l’arborescence', 3);
});

test('lire une quantité', async ({ page }) => {
  await demo(page);

  await openDestination(page, 'Quantités');

  await expect(
    page.getByRole('heading', { name: 'Nomenclature' }),
  ).toBeVisible();
  await expect(page.locator('.dashboard-card-value').first()).not.toHaveText(
    '',
  );
  await expectGestures(page, 'lire une quantité', 2);
});

test('lire une vérification', async ({ page }) => {
  await demo(page);

  await openDestination(page, 'Vérifications');

  await expect(page.locator('.alert-list li').first()).toBeVisible();
  await expectGestures(page, 'lire une vérification', 2);
});

test('lire un calcul', async ({ page }) => {
  await demo(page);

  await openDestination(page, 'Calculs');

  await expect(page.locator('.dashboard-card-value').first()).toBeVisible();
  await expectGestures(page, 'lire un calcul', 2);
});

test('exporter le plan', async ({ page }) => {
  await demo(page);

  const download = page.waitForEvent('download');
  await fileAction(page, 'Exporter le SVG');

  expect((await download).suggestedFilename()).toMatch(/\.svg$/u);
  await expectGestures(page, 'exporter le plan', 2);
});

test('enregistrer le projet', async ({ page }) => {
  await demo(page);

  const download = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');

  expect((await download).suggestedFilename()).toMatch(/\.houseproj$/u);
  await expectGestures(page, 'enregistrer le projet', 2);
});
