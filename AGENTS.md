AGENTS.md - Mix Martial Academy Site

Mission :
Construire et maintenir le site officiel de Mix Martial Academy, club de MMA au Rove.
Le site doit être simple, rapide, gratuit, responsive, épuré, sérieux, premium, et hébergé sur GitHub Pages.

Priorité absolue :
Les données validées dans js/clubData.js sont la seule source de vérité.
Ne jamais inventer, modifier ou extrapoler :
- horaires ;
- âges ;
- tarifs ;
- conditions d'inscription ;
- matériel obligatoire ;
- adresse ;
- contacts ;
- liens sociaux ;
- mentions légales ;
- règles HelloAsso ;
- règles de remboursement.

Si une information manque, insérer un placeholder clair ou demander validation uniquement si c'est bloquant.

Style attendu :
- épuré ;
- noir / rouge / blanc / gris métal ;
- premium MMA ;
- moderne ;
- lisible ;
- mobile-first ;
- sans surcharge visuelle ;
- sans longue liste visible de communes.

Données sensibles :
Ne jamais exposer :
- clé API ;
- token ;
- secret HelloAsso ;
- accès GitHub ;
- donnée adhérent ;
- document privé ;
- information personnelle non nécessaire au site public.

Le dépôt GitHub Pages est public par défaut. Tout ce qui y est mis doit être publiable.

Inscription :
Le lien HelloAsso ne doit être accessible que si toutes les cases obligatoires sont cochées.

Les cases obligatoires doivent couvrir :
- adhésion annuelle ferme et définitive ;
- absence de remboursement total ou partiel ;
- absence de remboursement même en cas d'arrêt, absence, blessure ou changement de situation ;
- paiement automatiquement en 3 fois sans frais via HelloAsso ;
- suspension possible de l'accès aux cours en cas d'échéance refusée non régularisée ;
- acceptation du règlement intérieur ;
- acceptation du matériel obligatoire ;
- règle des gants de boxe 16 oz uniquement.

Chatbot :
Le chatbot V1 est une FAQ statique, sans IA payante.
Il doit répondre uniquement avec les données présentes dans clubData.js.
Pour le matériel, le chatbot doit d'abord demander la section :
- enfant 6 à 11 ans ;
- ado 12 à 16 ans ;
- adulte 17 ans et plus.
Il ne doit jamais inventer de réponse.
Si la réponse n'existe pas, il doit inviter à contacter le club par WhatsApp ou email.

SEO :
Le SEO local doit viser naturellement :
- MMA Le Rove ;
- club MMA Le Rove ;
- cours MMA Le Rove ;
- club MMA proche Marseille ;
- MMA Côte Bleue ;
- Gignac-la-Nerthe ;
- Ensuès-la-Redonne ;
- L'Estaque ;
- Les Pennes-Mirabeau ;
- Châteauneuf-les-Martigues ;
- Vitrolles ;
- Marignane ;
- Carry-le-Rouet ;
- Sausset-les-Pins.

Ne pas afficher une longue liste de communes en façade.
Les utiliser naturellement dans les métadonnées, contenus SEO, alt text et JSON-LD.
Ne pas faire de keyword stuffing.

Validation obligatoire :
Avant de considérer la tâche terminée :
1. Vérifier que le site s'ouvre localement.
2. Vérifier le responsive mobile.
3. Vérifier que le bouton HelloAsso est bloqué tant que les cases ne sont pas cochées.
4. Vérifier que les horaires, tarifs et âges sont exacts.
5. Vérifier que le chatbot répond correctement.
6. Vérifier qu'aucun secret n'est présent.
7. Vérifier que les liens sociaux fonctionnent.
8. Vérifier que les mentions légales existent.
9. Vérifier que le site est prêt pour GitHub Pages.

Interdictions :
Ne pas créer de backend.
Ne pas ajouter de base de données.
Ne pas ajouter d'API OpenAI.
Ne pas ajouter d'API HelloAsso en V1.
Ne pas ajouter de dépendance lourde.
Ne pas transformer le site en application complexe.
Ne pas remplacer les données validées.
