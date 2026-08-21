// Applique les migrations SQL générées par `npm run db:generate` (drizzle-kit).
// Utilisé en dev (après un changement de schéma) et en prod (au déploiement).
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

async function main() {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations appliquées.");
  await pool.end();
}

main().catch((err) => {
  console.error("Échec des migrations :", err);
  process.exit(1);
});
