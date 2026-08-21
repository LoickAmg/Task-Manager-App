// Crée le compte admin (mono-utilisateur) et un board de démo s'ils n'existent
// pas déjà. Idempotent : peut être relancé sans dupliquer les données.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { users, boards, boardMembers, lists, tags, tasks } from "./schema.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL || "admin@example.com";
  const password = process.env.SEED_USER_PASSWORD || "changeme123";
  const name = process.env.SEED_USER_NAME || "Admin";

  let [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
    console.log(`Utilisateur créé : ${email}`);
  } else {
    console.log(`Utilisateur déjà présent : ${email}`);
  }

  const existingBoards = await db
    .select()
    .from(boards)
    .where(eq(boards.ownerId, user.id));

  if (existingBoards.length === 0) {
    const [board] = await db
      .insert(boards)
      .values({ name: "Mon premier board", description: "Board de démo créé au seed.", ownerId: user.id })
      .returning();

    await db.insert(boardMembers).values({ boardId: board.id, userId: user.id, role: "owner" });

    const [todo, inProgress, done] = await db
      .insert(lists)
      .values([
        { name: "À faire", position: 0, boardId: board.id },
        { name: "En cours", position: 1, boardId: board.id },
        { name: "Terminé", position: 2, boardId: board.id },
      ])
      .returning();

    const [urgent, bug] = await db
      .insert(tags)
      .values([
        { name: "Urgent", color: "#ff6b6b", boardId: board.id },
        { name: "Bug", color: "#ffa94d", boardId: board.id },
      ])
      .returning();

    const [firstTask] = await db
      .insert(tasks)
      .values({
        title: "Découvrir le Kanban",
        description: "Glisse-dépose cette carte dans « En cours » pour tester.",
        priority: "medium",
        position: 0,
        listId: todo.id,
      })
      .returning();

    await db.insert(tasks).values([
      { title: "Ajouter un tag à une tâche", priority: "low", position: 1, listId: todo.id },
      { title: "Exemple en cours", priority: "high", position: 0, listId: inProgress.id },
      { title: "Exemple terminé", priority: "low", position: 0, listId: done.id },
    ]);

    console.log(`Board de démo créé avec des tags (${urgent.name}, ${bug.name}) et une tâche (${firstTask.title}).`);
  } else {
    console.log("Board de démo déjà présent, rien à faire.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Échec du seed :", err);
  process.exit(1);
});
