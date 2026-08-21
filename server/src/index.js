import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieSession from "cookie-session";

import { authRouter } from "./routes/auth.js";
import { boardsRouter, listsRouter, tagsRouter } from "./routes/boards.js";
import { listTasksRouter, tasksRouter, subtasksRouter, commentsRouter } from "./routes/tasks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

export function createApp() {
  const app = express();

  if (isProd) {
    // Render (comme Heroku/Railway) termine le HTTPS au niveau du proxy et
    // transmet la requête en HTTP en interne. Sans ça, Express voit une
    // connexion "non sécurisée" et le module `cookies` (utilisé par
    // cookie-session) refuse silencieusement de poser un cookie marqué
    // `secure: true` — la session ne persiste jamais après le login.
    app.set("trust proxy", 1);
  }

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(isProd ? "combined" : "dev"));
  }
  app.use(express.json());

  if (!isProd) {
    // En prod, l'app Vue est servie par ce même service Express (même
    // origine) donc CORS n'est pas nécessaire. En dev, Vite tourne sur un
    // port séparé (5173) et doit pouvoir appeler l'API en localhost:4000.
    app.use(cors({ origin: "http://localhost:5173", credentials: true }));
  }

  app.use(
    cookieSession({
      name: "session",
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    }),
  );

  app.use("/api/auth", authRouter);
  app.use("/api/boards", boardsRouter);
  app.use("/api/lists", listsRouter);
  app.use("/api/lists", listTasksRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/subtasks", subtasksRouter);
  app.use("/api/comments", commentsRouter);

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  if (isProd) {
    const staticDir = path.join(__dirname, "..", "public");
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Middleware d'erreurs central : capte tout ce que asyncHandler transmet,
  // plus les erreurs Zod/Postgres non attrapées explicitement.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status < 500 ? err.message : "Erreur serveur." });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API démarrée sur http://localhost:${port}`);
  });
}
