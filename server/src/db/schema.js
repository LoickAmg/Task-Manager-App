// Schéma de données du Task Manager (Drizzle ORM).
//
// Conçu mono-utilisateur pour l'instant (un seul compte, seedé au démarrage)
// mais avec les tables déjà en place pour du multi-utilisateur futur :
// - `boardMembers` permet de partager un board avec d'autres comptes
//   (rôle owner / member) sans changer le modèle de données.
// - `tasks.assigneeId` permet d'assigner une tâche à un utilisateur.
// Tant qu'il n'y a qu'un seul utilisateur, ces relations pointent toutes
// vers ce même compte.

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const boardRoleEnum = pgEnum("board_role", ["owner", "member"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const boards = pgTable("boards", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const boardMembers = pgTable(
  "board_members",
  {
    id: id(),
    role: boardRoleEnum("role").notNull().default("member"),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("board_members_board_user_idx").on(table.boardId, table.userId)],
);

export const lists = pgTable(
  "lists",
  {
    id: id(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
  },
  (table) => [index("lists_board_idx").on(table.boardId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    priority: priorityEnum("priority").notNull().default("medium"),
    dueDate: timestamp("due_date"),
    position: integer("position").notNull(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("tasks_list_idx").on(table.listId)],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6ea8fe"),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("tags_board_name_idx").on(table.boardId, table.name)],
);

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.tagId] })],
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: id(),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    position: integer("position").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (table) => [index("subtasks_task_idx").on(table.taskId)],
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("comments_task_idx").on(table.taskId)],
);
