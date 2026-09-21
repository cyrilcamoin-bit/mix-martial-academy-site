# Mix Martial Academy - site officiel V1

Site statique officiel de Mix Martial Academy, club de MMA au Rove.

La V1 est volontairement simple : HTML, CSS, JavaScript vanilla et GitHub Pages. Aucun backend, aucune base de données, aucune API et aucune dépendance lourde.

## Ouvrir le site localement

Ouvrir directement `index.html` dans un navigateur.

Optionnel :

```bash
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Modifier les données du club

Toutes les données validées sont centralisées dans `js/clubData.js`.

Ne pas modifier les horaires, tarifs, âges, contacts, règles d'inscription, règles de remboursement, matériel ou mentions légales ailleurs que dans ce fichier.

## Remplacer le logo

Placer le logo officiel dans `assets/logo/`, idéalement en SVG validé par Cyril.

Remplacer ensuite le placeholder `A_COMPLETER_LOGO_VECTORIEL` dans `index.html`.

## Inscription HelloAsso

Le widget officiel HelloAsso est configuré dans `js/clubData.js`.

Le formulaire HelloAsso reste verrouillé tant que les conditions d'inscription ne sont pas acceptées.
Après acceptation, le widget s'affiche directement dans l'onglet `Tarifs & Inscriptions`.

## Déployer sur GitHub Pages

1. Pousser le dépôt sur GitHub.
2. Aller dans `Settings > Pages`.
3. Choisir la branche de publication, souvent `main`.
4. Choisir le dossier racine `/`.
5. Valider.

## Sécurité

Ne jamais mettre de clé API, secret HelloAsso, token GitHub ou données adhérents dans ce dépôt.

Le dépôt GitHub Pages est public par défaut. Tout ce qui y est ajouté doit être publiable.

## Contenu V1

- Landing page officielle responsive.
- Présentation du club.
- Horaires et tarifs validés.
- 3 cours d'essai offerts.
- Inscription HelloAsso avec cases obligatoires.
- Matériel obligatoire par section.
- Communauté WhatsApp officielle et réseaux sociaux.
- Contact et mentions légales.
- Chatbot FAQ statique sans IA ni API.

## V2 possible, non développée maintenant

- Espace administrateur sécurisé.
- Intégration API HelloAsso via backend sécurisé.
- Suivi des paiements.
- Détection des échéances refusées.
- Statuts adhérents.
- Relances.
- Cloudflare Worker.
- Stockage sécurisé.
- RGPD renforcé.


## V2 — certificats médicaux / HelloAsso

La branche `codex/helloasso-api-connection` ajoute un backend Cloudflare Worker pour :

- vérifier un adhérent uniquement par nom, prénom et date de naissance provenant de la campagne HelloAsso 2026/2027 ;
- ne jamais utiliser les coordonnées du payeur à la place de celles de l'adhérent ;
- recevoir un certificat PDF ;
- stocker un seul certificat actif par adhérent dans R2 ;
- exposer un suivi administrateur reçu/manquant ;
- télécharger un PDF individuel, une sélection ou tous les certificats reçus en ZIP.

Secrets Cloudflare requis :

- `HELLOASSO_CLIENT_ID`
- `HELLOASSO_CLIENT_SECRET`
- `ADMIN_API_TOKEN` pour l'espace administrateur

Binding Cloudflare requis :

- `CERTIFICATES` vers un bucket R2 privé.

Aucune clé API ni donnée adhérent ne doit être commitée dans GitHub.
