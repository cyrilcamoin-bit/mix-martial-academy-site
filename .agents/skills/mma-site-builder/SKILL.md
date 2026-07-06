---
name: mma-site-builder
description: Construire ou modifier rapidement le site statique officiel Mix Martial Academy. Utiliser pour toute tâche liée au site MMA, GitHub Pages, chatbot FAQ, inscription HelloAsso, design, SEO local ou contenu club.
---

Skill - Mix Martial Academy Site Builder

Objectif :
Créer une V1 rapide, propre et gratuite du site officiel Mix Martial Academy.

Le site doit être statique, hébergé sur GitHub Pages, sans backend, sans base de données, sans API payante.

Workflow obligatoire :
1. Lire AGENTS.md.
2. Lire js/clubData.js.
3. Identifier uniquement les fichiers nécessaires.
4. Modifier le minimum de fichiers possible.
5. Ne jamais inventer de donnée.
6. Vérifier le rendu mobile.
7. Vérifier le parcours inscription.
8. Vérifier le chatbot.
9. Vérifier l'absence de secrets.
10. Résumer les fichiers modifiés et pourquoi.

Architecture attendue :
- index.html : structure principale du site.
- css/style.css : design complet.
- js/clubData.js : toutes les données validées.
- js/chatbot.js : logique FAQ statique.
- js/inscription.js : blocage/déblocage HelloAsso.
- assets/ : logo, images, icônes.

Règles design :
- Site épuré.
- Noir profond, rouge combat, blanc, gris métal.
- Peu de texte visible à la fois.
- Gros boutons clairs.
- Sections aérées.
- Mobile-first.
- Ambiance MMA sérieuse, pas fitness flashy.

Règles chatbot :
Le chatbot doit répondre aux questions fréquentes :
- horaires ;
- tarifs ;
- cours d'essai ;
- inscription ;
- HelloAsso ;
- remboursement ;
- matériel ;
- Discord ;
- réseaux ;
- adresse ;
- contact.

Pour le matériel, toujours demander d'abord la section.

Règles inscription :
Le bouton d'inscription HelloAsso reste désactivé tant que toutes les conditions obligatoires ne sont pas cochées.
Le bouton peut pointer vers un placeholder tant que le vrai lien HelloAsso n'est pas fourni.

Fin de tâche :
Avant de terminer, fournir :
- fichiers modifiés ;
- vérifications faites ;
- points restant à valider par Cyril ;
- aucune donnée inventée.
