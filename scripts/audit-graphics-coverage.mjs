/**
 * Ce que le plan sait dessiner, famille par famille.
 *
 * Un plan d'architecte montre une baignoire comme une baignoire. Le moteur
 * sait le faire — la bibliothèque de glyphes existe, les emprises sont à
 * l'échelle du modèle — mais il ne le fait que pour les familles pour
 * lesquelles quelqu'un a écrit la correspondance. Tant qu'il y en avait trente-
 * neuf, une table écrite à la main suffisait et personne n'avait besoin de la
 * compter. La nomenclature en compte aujourd'hui cinq cent vingt-sept, dont
 * trois cent quatre-vingts posables : à cette taille, « on en a fait
 * quelques-unes » n'est plus une réponse, et « il en reste beaucoup » non plus.
 *
 * Cet outil répond par un nombre. Il lit les trois jeux de données réels — la
 * nomenclature sous `packages/catalog-registry/data/families`, la bibliothèque
 * sous `packages/drawing-engine/data/symbols`, et les correspondances entre les
 * deux dans `packages/drawing-engine/data/plan-bindings.json` — puis il suit,
 * pour chaque famille posable, exactement la chaîne que le moteur suivra :
 *
 *   1. le glyphe que la famille se voit attribuer — `graphics.planSymbol` sur
 *      sa fiche, et la correspondance de même nom sur la planche ;
 *   2. à défaut, le glyphe attribué à sa **catégorie** : un lavabo générique
 *      vaut mieux qu'un carré pour les dix-sept familles d'appareils
 *      sanitaires qui n'ont pas le leur, et une ligne les tient toutes ;
 *   3. à défaut, le **glyphe générique nommé**, qui est un objet posé dessiné
 *      comme tel et non un carré de trois cents millimètres sans nom ;
 *   4. et rien du tout, qui ne doit jamais arriver.
 *
 * Ce que l'outil ne dit pas : si le glyphe est **juste**. Une famille qui
 * nomme un symbole est comptée comme couverte, que le dessin ressemble ou non
 * à la chose. C'est une mesure de couverture, pas de qualité ; la qualité se
 * regarde sur une planche, et `npm run reference:graphic` en imprime une.
 *
 *     npm run graphics:coverage
 *     npm run graphics:coverage -- --check
 *     npm run graphics:coverage -- --detail
 *
 * `--check` est ce que la barrière exécute : il échoue si la couverture
 * **régresse** sous les seuils décidés plus bas. `--detail` déplie ce qui
 * retombe sur le générique, groupé par catégorie, c'est-à-dire la liste par
 * laquelle il faut commencer pour que le prochain chiffre soit meilleur.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILLES = join(ROOT, 'packages/catalog-registry/data/families');
const SYMBOLES = join(ROOT, 'packages/drawing-engine/data/symbols');
const BINDINGS = join(ROOT, 'packages/drawing-engine/data/plan-bindings.json');

/**
 * Le glyphe qu'un objet posé prend quand rien de plus précis n'existe.
 *
 * Lu dans le fichier de correspondances et non recopié ici : le dernier
 * maillon est une décision de la planche, et un audit qui garde sa propre
 * copie du dernier recours finit par mesurer un dernier recours que plus
 * personne ne dessine. Ce que ce script vérifie, c'est qu'il **existe** —
 * c'est ce qui rend « sans représentation » un défaut structurel et non une
 * fatalité de nomenclature incomplète.
 */
export function symboleGenerique() {
  return correspondances().generique;
}

/**
 * Ce sous quoi la couverture ne doit pas redescendre.
 *
 * Un seuil est une décision, pas une mesure : recopier ici le chiffre du jour
 * donnerait une barrière que le prochain chiffre du jour satisferait toujours.
 * Ces trois-là disent trois choses différentes et se lisent ensemble.
 *
 * Ils sont volontairement posés **au niveau atteint**, sans marge : la marge
 * est ce qui laisse une régression passer inaperçue, et la seule chose que
 * cette barrière existe pour empêcher est qu'une famille cesse d'être dessinée
 * sans que personne le remarque. Les relever fait partie du travail de les
 * dépasser ; les baisser demande d'écrire pourquoi, juste ici.
 */
export const SEUILS = {
  /**
   * Aucune famille posable ne peut rester sans rien.
   *
   * Ce n'est pas un objectif, c'est une propriété de la chaîne : tant qu'un
   * glyphe générique nommé est publié, le quatrième cas est inatteignable.
   * Zéro ici veut donc dire « le dernier maillon est toujours en place » — et
   * si ce nombre monte, ce n'est pas qu'une famille manque à l'appel, c'est
   * que le générique a disparu de la bibliothèque et que tout le reste ment.
   */
  sansRepresentationMaximum: 0,

  /**
   * Les familles dessinées par un glyphe plus précis que celui de leur
   * catégorie.
   *
   * Quarante-trois : une baignoire dessinée comme une baignoire et non comme
   * « un appareil sanitaire ». Ce sont les emprises d'espace modèle, celles
   * qu'on mesure sur le plan pour savoir si l'on passe entre deux.
   *
   * Une famille qui nomme exactement le glyphe de sa catégorie n'est pas
   * comptée ici : elle n'est pas dessinée plus finement pour autant, et ce
   * chiffre mesure la finesse du plan, pas le nombre de lignes écrites.
   *
   * Il ne peut que monter. Une famille qui perd son glyphe propre retombe sur
   * celui de sa catégorie — un plan moins précis, sans que rien ne casse, sans
   * qu'aucun test ne rougisse : exactement la perte silencieuse que cette
   * barrière existe pour attraper.
   */
  symboleSpecifiqueMinimum: 43,

  /**
   * Les familles tirées d'affaire par le glyphe de leur catégorie.
   *
   * C'est le maillon qui fait la différence entre quarante familles dessinées
   * et quatre cents. Dix-huit catégories déclarées valent ici cent vingt-trois
   * familles ; les écrire une par une aurait demandé cent vingt-trois lignes
   * et les aurait laissées se désaccorder. Le seuil garde cette économie :
   * perdre une déclaration de catégorie ne coûte pas une famille, elle en
   * coûte jusqu'à vingt et une d'un coup.
   */
  repliCategorieMinimum: 123,

  /**
   * Les familles qui n'ont toujours que le glyphe générique.
   *
   * Le seul seuil qui soit un plafond, et le seul qu'on cherche à faire
   * baisser. Deux cent quatorze, réparties sur vingt-six catégories qu'aucun
   * glyphe ne tient encore : raccords, organes de commande, capteurs,
   * mobilier, menuiseries. Chacune est un dessin à faire, pas une ligne de
   * code à écrire — c'est tout l'intérêt d'avoir sorti la table du TypeScript,
   * et c'est ce que `--detail` sert à lire.
   *
   * Trente-cinq de ces deux cent quatorze sont des menuiseries, qui n'ont que
   * faire d'un glyphe : elles sont dessinées par leur baie. Le plafond les
   * garde quand même, parce qu'un chiffre dont on retire les cas gênants n'est
   * plus un chiffre.
   */
  repliGeneriqueMaximum: 214,
};

/** Les fichiers JSON d'un dossier, triés, pour que deux exécutions concordent. */
function fichiersJson(dossier) {
  const trouves = [];
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersJson(chemin));
    else if (nom.endsWith('.json')) trouves.push(chemin);
  }
  return trouves;
}

/**
 * La nomenclature telle que les fichiers l'écrivent.
 *
 * Lue depuis les données et non depuis le paquet compilé : un audit qui passe
 * par le registre mesurerait ce que le registre veut bien montrer, alors que
 * la question posée ici — « qu'est-ce qui est écrit ? » — porte sur les
 * fichiers eux-mêmes.
 */
export function famillesDeclarees() {
  return fichiersJson(FAMILLES).flatMap(
    (fichier) => JSON.parse(readFileSync(fichier, 'utf8')).families ?? [],
  );
}

/** Les glyphes que l'application embarque, tous fichiers confondus. */
export function symbolesEmbarques() {
  return fichiersJson(SYMBOLES).flatMap(
    (fichier) => JSON.parse(readFileSync(fichier, 'utf8')).symbols ?? [],
  );
}

/**
 * Les familles dont un objet peut être posé dans la maison.
 *
 * Deux filtres, et pas un de plus. **Posable** : les registres `EQUIPMENT` et
 * `OPENING` sont ceux dont les fiches sont placées quelque part ; un matériau,
 * un produit de réseau ou une composition de paroi n'a pas de glyphe parce
 * qu'il n'a pas d'emplacement. **Active** : une famille retirée du service
 * continue d'ouvrir les projets qui la portent, mais on ne la propose plus, et
 * lui reprocher de ne pas être dessinée reviendrait à gonfler le dénominateur
 * avec du travail que personne ne veut voir fait.
 */
export function famillesPosables(familles = famillesDeclarees()) {
  return familles.filter(
    (famille) =>
      (famille.registry === 'EQUIPMENT' || famille.registry === 'OPENING') &&
      (famille.lifecycle ?? 'ACTIVE') === 'ACTIVE',
  );
}

/**
 * Les correspondances telles que la planche les écrit.
 *
 * `packages/drawing-engine/data/plan-bindings.json` : quel glyphe
 * dessine quelle famille, et quel glyphe dessine « une chose de cette
 * catégorie dont on ne sait rien de plus ». C'est la moitié de la déclaration
 * que le moteur de plan sait lire — il part de la bibliothèque, jamais de la
 * nomenclature, parce que `view-query` ne dépend pas de `catalog-registry` et
 * ne doit pas commencer à en dépendre pour dessiner un lavabo. L'autre moitié
 * est `graphics.planSymbol` sur la fiche de famille ; `desaccords` ci-dessous
 * refuse qu'elles divergent.
 */
export function correspondances() {
  const fichier = JSON.parse(readFileSync(BINDINGS, 'utf8'));
  return {
    parFamille: new Map(Object.entries(fichier.bindings?.families ?? {})),
    parCategorie: new Map(Object.entries(fichier.bindings?.categories ?? {})),
    generique: fichier.fallback,
  };
}

/**
 * Là où la nomenclature et la planche ne disent pas la même chose.
 *
 * Une déclaration écrite à deux endroits est une déclaration qui finira par se
 * contredire : dix familles le faisaient déjà avant ce travail — la fiche
 * annonçait un glyphe schématique, le plan dessinait l'emprise — et personne
 * ne l'avait vu, parce que rien ne posait la question. Elle est posée ici, à
 * chaque exécution, dans les deux sens.
 */
export function desaccords(
  familles = famillesDeclarees(),
  { parFamille } = correspondances(),
) {
  const restants = new Map(parFamille);
  const trouves = [];
  for (const famille of familles) {
    const declare = famille.graphics?.planSymbol;
    const tenu = parFamille.get(famille.id);
    restants.delete(famille.id);
    if (declare === tenu) continue;
    trouves.push({
      famille: famille.id,
      declare: declare ?? '(rien)',
      tenu: tenu ?? '(rien)',
    });
  }
  for (const [famille, tenu] of restants)
    trouves.push({ famille, declare: '(famille inconnue)', tenu });
  return trouves;
}

/**
 * Ce que le plan dessinera pour chaque famille, et par quel maillon.
 *
 * Rendu comme une liste de familles plutôt qu'un total, parce que le total
 * n'est utile qu'une fois : la deuxième question est toujours « lesquelles ? ».
 */
export function couverture() {
  const symboles = symbolesEmbarques();
  const familles = famillesDeclarees();
  const connus = new Set(symboles.map(({ id }) => id));
  const table = correspondances();
  const { parCategorie } = table;
  // Un renvoi vers un glyphe que la bibliothèque ne contient pas ne casse
  // rien : le plan cherche un identifiant, ne le trouve pas, et dessine le
  // carré — c'est-à-dire comme avant, sans que personne ne l'apprenne.
  const renvoisMorts = [
    ...[...table.parFamille].map(([clef, id]) => ['families', clef, id]),
    ...[...parCategorie].map(([clef, id]) => ['categories', clef, id]),
  ]
    .filter(([, , id]) => !connus.has(id))
    .map(([niveau, clef, id]) => ({ niveau, clef, symbole: id }));
  const generiqueExiste = connus.has(table.generique);

  const lignes = famillesPosables(familles).map((famille) => {
    const nomme = famille.graphics?.planSymbol;
    // Une famille qui nomme un glyphe absent est une donnée fausse, pas une
    // famille moins couverte : elle est comptée comme non couverte et signalée
    // à part, faute de quoi la barrière verdirait sur une erreur.
    const propre = nomme !== undefined && connus.has(nomme) ? nomme : undefined;
    const parDefaut = parCategorie.get(famille.category);
    // Ce qu'on compte est la **précision du plan**, pas le nombre de lignes
    // écrites. Une famille qui nomme exactement le glyphe que sa catégorie lui
    // aurait donné n'est pas dessinée plus finement pour autant : elle est
    // comptée avec sa catégorie. Sans quoi le chiffre monterait chaque fois
    // qu'on recopie une déclaration, ce qui est le contraire d'une mesure.
    const symbole = propre ?? parDefaut;
    const maillon =
      propre !== undefined && propre !== parDefaut
        ? 'SPECIFIQUE'
        : symbole !== undefined
          ? 'CATEGORIE'
          : generiqueExiste
            ? 'GENERIQUE'
            : 'AUCUN';
    return {
      id: famille.id,
      label: famille.label,
      registry: famille.registry,
      categorie: famille.category,
      maillon,
      symbole: symbole ?? (generiqueExiste ? table.generique : undefined),
      ...(nomme !== undefined && !connus.has(nomme)
        ? { symboleIntrouvable: nomme }
        : {}),
    };
  });

  const compte = (maillon) =>
    lignes.filter((ligne) => ligne.maillon === maillon).length;
  return {
    lignes,
    generique: table.generique,
    renvoisMorts,
    generiqueExiste,
    desaccords: desaccords(familles, table),
    introuvables: lignes.filter((ligne) => ligne.symboleIntrouvable),
    totaux: {
      posables: lignes.length,
      specifique: compte('SPECIFIQUE'),
      categorie: compte('CATEGORIE'),
      generique: compte('GENERIQUE'),
      aucun: compte('AUCUN'),
    },
  };
}

/**
 * Ce qui empêche le rapport d'être tenu pour bon.
 *
 * Séparé de l'affichage pour que le test de la suite pose la même question que
 * la barrière, sans relire une sortie texte.
 */
export function manquements(resultat = couverture()) {
  const { totaux } = resultat;
  const echecs = [];
  for (const { id } of resultat.introuvables)
    echecs.push(
      `La famille ${id} nomme le symbole ${resultat.lignes.find((l) => l.id === id).symboleIntrouvable}, que la bibliothèque ne contient pas.`,
    );
  for (const { niveau, clef, symbole } of resultat.renvoisMorts)
    echecs.push(
      `La correspondance ${niveau}/${clef} nomme le glyphe ${symbole}, que la bibliothèque ne contient pas.`,
    );
  for (const { famille, declare, tenu } of resultat.desaccords)
    echecs.push(
      `${famille} : la nomenclature dit ${declare}, la bibliothèque dit ${tenu}.`,
    );
  if (!resultat.generiqueExiste)
    echecs.push(
      `Le glyphe générique ${resultat.generique} a disparu de la bibliothèque : plus rien ne rattrape une famille sans symbole.`,
    );
  if (totaux.aucun > SEUILS.sansRepresentationMaximum)
    echecs.push(
      `${totaux.aucun} famille(s) sans représentation ; le seuil est ${SEUILS.sansRepresentationMaximum}.`,
    );
  if (totaux.specifique < SEUILS.symboleSpecifiqueMinimum)
    echecs.push(
      `${totaux.specifique} famille(s) nomment leur symbole ; le seuil est ${SEUILS.symboleSpecifiqueMinimum}.`,
    );
  if (totaux.categorie < SEUILS.repliCategorieMinimum)
    echecs.push(
      `${totaux.categorie} famille(s) tenues par leur catégorie ; le seuil est ${SEUILS.repliCategorieMinimum}.`,
    );
  if (totaux.generique > SEUILS.repliGeneriqueMaximum)
    echecs.push(
      `${totaux.generique} famille(s) retombent sur le glyphe générique ; le plafond est ${SEUILS.repliGeneriqueMaximum}.`,
    );
  return echecs;
}

/** Un nombre aligné à droite, pour que quatre lignes se lisent en colonne. */
function colonne(valeur) {
  return String(valeur).padStart(4);
}

function main() {
  const resultat = couverture();
  const { totaux, lignes } = resultat;
  const ouvertures = lignes.filter(
    (ligne) => ligne.registry === 'OPENING',
  ).length;

  console.log(`Familles actives posables : ${colonne(totaux.posables)}`);
  console.log(`  symbole spécifique       ${colonne(totaux.specifique)}`);
  console.log(`  repli par catégorie      ${colonne(totaux.categorie)}`);
  console.log(`  repli générique          ${colonne(totaux.generique)}`);
  console.log(`  sans représentation      ${colonne(totaux.aucun)}`);

  // Dit à part parce que le chiffre du dessus se lirait autrement sans lui :
  // une menuiserie est posée dans un mur et dessinée par sa baie — tableaux,
  // ébrasements, arc de battant — et non par un glyphe posé au centre. Elle
  // compte parmi les posables parce qu'on la pose ; le glyphe qu'elle prend
  // n'est jamais dessiné.
  console.log(
    `\nDont ${ouvertures} menuiserie(s) : posées dans une paroi et dessinées par leur baie,`,
  );
  console.log(
    '  pas par un glyphe. Leur ligne ci-dessus mesure une chaîne qui ne les sert pas.',
  );

  const { parCategorie } = correspondances();
  const parCategorieFamilles = new Map();
  for (const ligne of lignes) {
    const clef = ligne.categorie ?? '(sans catégorie)';
    parCategorieFamilles.set(clef, [
      ...(parCategorieFamilles.get(clef) ?? []),
      ligne,
    ]);
  }
  const decouvertes = [...parCategorieFamilles.entries()]
    .filter(([categorie]) => !parCategorie.has(categorie))
    .map(([categorie, membres]) => ({
      categorie,
      membres,
      restants: membres.filter((ligne) => ligne.maillon === 'GENERIQUE').length,
    }))
    .filter(({ restants }) => restants > 0)
    .sort((gauche, droite) => droite.restants - gauche.restants);

  console.log(
    `\n${decouvertes.length} catégorie(s) qu'aucun glyphe ne tient encore, du plus coûteux au moins :`,
  );
  for (const { categorie, restants } of decouvertes)
    console.log(`  ${colonne(restants)}  ${categorie}`);
  console.log(
    '\nUn dessin par ligne rendrait ce nombre de familles à la fois. C’est le bon',
  );
  console.log('ordre de travail : la catégorie avant la famille.');

  if (process.argv.includes('--detail'))
    for (const { categorie, membres } of decouvertes) {
      console.log(`\n${categorie}`);
      for (const ligne of membres.filter((l) => l.maillon === 'GENERIQUE'))
        console.log(`  ${ligne.id} — ${ligne.label}`);
    }

  const echecs = manquements(resultat);
  if (!process.argv.includes('--check')) {
    if (echecs.length > 0) {
      console.log('\nÀ noter :');
      for (const echec of echecs) console.log(`  - ${echec}`);
    }
    return;
  }
  if (echecs.length > 0) {
    console.error('\nLa couverture graphique a régressé :');
    for (const echec of echecs) console.error(`  - ${echec}`);
    console.error(
      '\nSoit un glyphe a été retiré, soit une déclaration a été perdue en route.',
    );
    console.error(
      'Décider ce qui est voulu, puis corriger la donnée ou déplacer le seuil —',
    );
    console.error('dans `SEUILS`, avec la phrase qui dit pourquoi il bouge.');
    process.exit(1);
  }
  console.log('\nCouverture tenue.');
}

if (process.argv[1]?.endsWith('audit-graphics-coverage.mjs')) main();
