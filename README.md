# Task Manager

App de gestion de tâches façon Trello/Kanban : colonnes, tags, sous-tâches,
commentaires, échéances. Mono-utilisateur pour l'instant, avec un schéma de
données déjà prêt pour du multi-utilisateur (partage de board, assignation).

## Stack

Backend **Node.js/Express** (API REST) + **Drizzle ORM** + **PostgreSQL**,
frontend **Vue 3** (Composition API) + **Pinia** + **Vite**, sans framework
CSS (thème sombre écrit à la main).

> **Choix d’architecture.** Node/Express fournit une API REST lisible et Vue 3
> gère l’état de l’interface ; Drizzle garde les requêtes SQL et les migrations
> explicites. Cette séparation permet de tester les règles du tableau côté API
> et les interactions Kanban côté frontend sans confondre état d’interface et
> autorisation serveur.

## Fonctionnalités

- **Boards** multiples, chacun avec ses propres listes/colonnes
- **Kanban** : glisser-déposer les tâches entre colonnes et au sein d'une
  colonne (drag & drop HTML5 natif, sans librairie)
- **Tags** par board, à plusieurs par tâche
- **Sous-tâches** (checklist) par tâche
- **Commentaires** par tâche
- **Priorité** (basse/moyenne/haute) et **échéance**
- **Auth** par session (cookie httpOnly) — un seul compte pour l'instant

## Prêt pour le multi-utilisateur

Le schéma de données (`server/src/db/schema.js`) inclut déjà :

- `board_members` : partage d'un board entre plusieurs comptes (rôle
  `owner`/`member`) — aujourd'hui il n'y a qu'une ligne par board (le
  compte unique), mais ajouter un membre est juste une insertion.
- `tasks.assignee_id` : assignation d'une tâche à un utilisateur.

Passer au multi-utilisateur plus tard ne demande pas de migration de
schéma, juste un écran d'invitation et l'ouverture de la création de compte.

## Structure du repo

```
server/          API Express (routes REST, Drizzle, auth par session)
  src/db/        schéma, migrations générées, client, seed
  src/routes/    boards, lists, tags, tasks, subtasks, comments, auth
  tests/         tests d'intégration (vitest + supertest, Postgres réel)
web/             SPA Vue 3 (Vite)
  src/stores/    Pinia (auth, board — état + appels API)
  src/components/  TaskCard, KanbanColumn, TaskDetailModal
  src/views/     LoginView, BoardsView, BoardView
  tests/         tests de composants et de stores (vitest + @vue/test-utils)
```

## Développement en local

Prérequis : Node 20+, une base PostgreSQL locale (Docker le plus simple).

```bash
# Démarrer Postgres (ou utilise une install locale existante)
docker run --name taskmanager-db -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16
docker exec taskmanager-db psql -U postgres -c "CREATE DATABASE taskmanager;"
docker exec taskmanager-db psql -U postgres -c "CREATE DATABASE taskmanager_test;"

npm install
cp server/.env.example server/.env   # ajuster si besoin
npm run db:migrate
npm run db:seed                       # crée le compte admin@example.com / changeme123

npm run dev:server   # API sur :4000
npm run dev:web       # SPA sur :5173 (proxy /api vers :4000)
```

Ouvre `http://localhost:5173`, connecte-toi avec les identifiants seedés
(modifiables via les variables `SEED_USER_*` de `server/.env` avant le
premier `db:seed`).

## Tests et lint

```bash
npm run lint    # server (eslint) + web (eslint + eslint-plugin-vue)
npm test        # server : 21 tests d'intégration sur Postgres réel
                 # web : 15 tests de composants/stores (jsdom)
```

Les tests serveur utilisent une vraie base Postgres (`taskmanager_test`),
vidée avant chaque test — pas de mock de la BDD, pour attraper de vrais
bugs de requêtes/transactions (le déplacement de tâche entre colonnes,
par exemple, est testé avec de vraies transactions SQL).

Le rendu Canvas/DOM du Kanban (drag & drop, mise en page de la modale de
détail) a été vérifié visuellement (captures d'écran + simulation de
glisser-déposer via Playwright) plutôt que par des tests automatisés.

## Permissions, concurrence et limites

Le mode actuel est mono-utilisateur, mais le serveur ne doit jamais considérer un identifiant de board ou de tâche comme une preuve d’accès. Chaque route doit vérifier la session puis l’appartenance au board avant de lire ou modifier une ressource. Le schéma `board_members` prépare le partage ; il ne signifie pas que le partage est déjà activé dans l’interface.

Le déplacement d’une tâche doit rester atomique côté serveur afin d’éviter deux positions incohérentes lors de mises à jour concurrentes. Les tests de permissions et de contraintes métier doivent être exécutés contre PostgreSQL, tandis que les données seedées (`admin@example.com` / `changeme123`) restent strictement réservées au développement local et doivent être remplacées avant toute exposition réseau.

## Licence

MIT — voir [LICENSE](./LICENSE).
