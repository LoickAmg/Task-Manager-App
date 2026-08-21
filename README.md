# Task Manager

App de gestion de tâches façon Trello/Kanban : colonnes, tags, sous-tâches,
commentaires, échéances. Mono-utilisateur pour l'instant, avec un schéma de
données déjà prêt pour du multi-utilisateur (partage de board, assignation).

## Stack

Backend **Node.js/Express** (API REST) + **Drizzle ORM** + **PostgreSQL**,
frontend **Vue 3** (Composition API) + **Pinia** + **Vite**, sans framework
CSS (thème sombre écrit à la main).

> La roadmap prévoyait Laravel (PHP) + Vue.js. Le backend a été pivoté vers
> Node/Express car l'installateur PHP (Composer/Packagist) n'était pas
> accessible dans mon environnement de build — même situation déjà
> rencontrée sur le projet Manga Quoting. Vue.js reste bien le frontend.
> Drizzle (plutôt que Prisma, utilisé sur d'autres projets) a été choisi
> pour la même raison : Prisma télécharge un moteur binaire natif depuis
> `binaries.prisma.sh`, également bloqué ici. Drizzle génère du SQL pur et
> ne dépend d'aucun binaire externe.

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

## Déploiement (Render + Neon)

1. **Neon** : crée un projet Postgres gratuit sur [neon.tech](https://neon.tech),
   récupère la `DATABASE_URL` (avec `?sslmode=require`).
2. **Render** : crée un *Web Service* pointant sur ce repo.
   - Build command : `npm ci && npm run build:web && npm run db:migrate`
   - Start command : `npm start`
   - Variables d'environnement : `DATABASE_URL` (celle de Neon),
     `SESSION_SECRET` (valeur aléatoire), `NODE_ENV=production`,
     `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` (pour le
     premier `db:seed`, à lancer une fois manuellement depuis le Shell
     Render : `npm run db:seed`).
3. Le plan gratuit de Render met le service en veille après 15 min
   d'inactivité (le réveil prend ~1 min) — normal pour un projet perso.

Aucune configuration Docker nécessaire : Render détecte Node.js et utilise
directement les commandes ci-dessus.

## Licence

MIT — voir [LICENSE](./LICENSE).
