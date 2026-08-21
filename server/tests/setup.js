import { beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db/client.js";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
});

// Table vide entre chaque test pour garder les tests indépendants les uns
// des autres, sans avoir à recréer le schéma à chaque fois (lent).
beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      comments, subtasks, task_tags, tasks, tags, lists, board_members, boards, users
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});
