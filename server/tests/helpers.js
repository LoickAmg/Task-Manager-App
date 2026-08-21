import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/index.js";
import { db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";

export const app = createApp();

// Crée un utilisateur et renvoie un agent supertest déjà authentifié
// (cookie de session conservé entre les requêtes de l'agent).
export async function loginAsNewUser({ email = "test@example.com", password = "password123", name = "Test" } = {}) {
  const passwordHash = await bcrypt.hash(password, 4);
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);

  return { agent, user };
}
