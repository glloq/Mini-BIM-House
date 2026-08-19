# Maison de référence MVP

`reference.houseproj.json` est le scénario d'intégration de la PR-069. Il décrit
une maison de plain-pied de 80 m², divisée en quatre pièces, avec une enveloppe
isolée, des ouvertures, une toiture photovoltaïque et des réseaux d'eau,
évacuation, ventilation et électricité.

Cette fixture est volontairement déterministe. Les valeurs techniques sont des
données de démonstration sourcées comme telles et ne constituent ni des valeurs
réglementaires, ni un dimensionnement de chantier. Les résultats calculés ne
sont pas persistés dans le projet.

Le test end-to-end charge et valide le fichier, exécute les adaptateurs de calcul,
contrôle la conservation énergétique, sauvegarde/recharge le projet et exporte
un plan SVG sémantique.
