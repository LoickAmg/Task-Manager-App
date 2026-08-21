import { Router } from "express";
import { z } from "zod";
import { eq, and, gte, gt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { tasks, taskTags, tags, subtasks, comments } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { assertBoardAccess, getBoardIdForList, getBoardIdForTask } from "../lib/access.js";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

const moveTaskSchema = z.object({
  listId: z.string(),
  position: z.number().int().min(0),
});

async function assertTaskAccess(userId, taskId) {
  const boardId = await getBoardIdForTask(taskId);
  if (!boardId) {
    const error = new Error("Tâche introuvable.");
    error.status = 404;
    throw error;
  }
  await assertBoardAccess(userId, boardId);
  return boardId;
}

// --- Tâches, montées sous /api/lists/:listId/tasks et /api/tasks/:taskId ---
export const listTasksRouter = Router();
listTasksRouter.use(requireAuth);

listTasksRouter.post(
  "/:listId/tasks",
  asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const boardId = await getBoardIdForList(listId);
    if (!boardId) return res.status(404).json({ error: "Liste introuvable." });
    await assertBoardAccess(req.userId, boardId);

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Tâche invalide." });

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(eq(tasks.listId, listId));

    const [task] = await db
      .insert(tasks)
      .values({ ...parsed.data, listId, position: count })
      .returning();

    res.status(201).json({ ...task, tags: [], subtasks: [] });
  }),
);

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.patch(
  "/:taskId",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    const data = { ...parsed.data, updatedAt: new Date() };
    if ("dueDate" in data && data.dueDate) data.dueDate = new Date(data.dueDate);

    const [updated] = await db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning();
    res.json(updated);
  }),
);

tasksRouter.delete(
  "/:taskId",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);
    await db.delete(tasks).where(eq(tasks.id, taskId));
    res.status(204).end();
  }),
);

// Déplace une tâche vers une autre liste et/ou une autre position, en
// recalant proprement les positions des tâches voisines (liste source et
// liste de destination) dans une transaction.
tasksRouter.post(
  "/:taskId/move",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);

    const parsed = moveTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Cible de déplacement invalide." });

    const destBoardId = await getBoardIdForList(parsed.data.listId);
    if (!destBoardId) return res.status(404).json({ error: "Liste de destination introuvable." });
    await assertBoardAccess(req.userId, destBoardId);

    const { listId: destListId, position: destPosition } = parsed.data;

    await db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      const { listId: sourceListId, position: sourcePosition } = task;

      if (sourceListId === destListId) {
        if (destPosition === sourcePosition) return;
        if (destPosition < sourcePosition) {
          await tx
            .update(tasks)
            .set({ position: sql`${tasks.position} + 1` })
            .where(
              and(eq(tasks.listId, sourceListId), gte(tasks.position, destPosition), gt(tasks.position, -1)),
            );
        } else {
          await tx
            .update(tasks)
            .set({ position: sql`${tasks.position} - 1` })
            .where(and(eq(tasks.listId, sourceListId), gt(tasks.position, sourcePosition)));
        }
      } else {
        // Combler le trou laissé dans la liste source.
        await tx
          .update(tasks)
          .set({ position: sql`${tasks.position} - 1` })
          .where(and(eq(tasks.listId, sourceListId), gt(tasks.position, sourcePosition)));

        // Faire de la place dans la liste de destination.
        await tx
          .update(tasks)
          .set({ position: sql`${tasks.position} + 1` })
          .where(and(eq(tasks.listId, destListId), gte(tasks.position, destPosition)));
      }

      await tx
        .update(tasks)
        .set({ listId: destListId, position: destPosition, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    });

    const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    res.json(updated);
  }),
);

tasksRouter.post(
  "/:taskId/tags",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const boardId = await assertTaskAccess(req.userId, taskId);

    const parsed = z.object({ tagId: z.string() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Tag invalide." });

    const [tag] = await db.select().from(tags).where(eq(tags.id, parsed.data.tagId));
    if (!tag || tag.boardId !== boardId) return res.status(404).json({ error: "Tag introuvable sur ce board." });

    await db.insert(taskTags).values({ taskId, tagId: tag.id }).onConflictDoNothing();
    res.status(201).json(tag);
  }),
);

tasksRouter.delete(
  "/:taskId/tags/:tagId",
  asyncHandler(async (req, res) => {
    const { taskId, tagId } = req.params;
    await assertTaskAccess(req.userId, taskId);
    await db.delete(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)));
    res.status(204).end();
  }),
);

tasksRouter.post(
  "/:taskId/subtasks",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);

    const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Sous-tâche invalide." });

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId));

    const [subtask] = await db
      .insert(subtasks)
      .values({ title: parsed.data.title, taskId, position: count })
      .returning();

    res.status(201).json(subtask);
  }),
);

tasksRouter.post(
  "/:taskId/comments",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);

    const parsed = z.object({ body: z.string().trim().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Commentaire invalide." });

    const [comment] = await db
      .insert(comments)
      .values({ body: parsed.data.body, taskId, userId: req.userId })
      .returning();

    res.status(201).json(comment);
  }),
);

tasksRouter.get(
  "/:taskId/comments",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    await assertTaskAccess(req.userId, taskId);
    const rows = await db.select().from(comments).where(eq(comments.taskId, taskId)).orderBy(comments.createdAt);
    res.json(rows);
  }),
);

export const subtasksRouter = Router();
subtasksRouter.use(requireAuth);

async function assertSubtaskAccess(userId, subtaskId) {
  const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, subtaskId));
  if (!subtask) {
    const error = new Error("Sous-tâche introuvable.");
    error.status = 404;
    throw error;
  }
  await assertTaskAccess(userId, subtask.taskId);
  return subtask;
}

subtasksRouter.patch(
  "/:subtaskId",
  asyncHandler(async (req, res) => {
    const { subtaskId } = req.params;
    await assertSubtaskAccess(req.userId, subtaskId);

    const parsed = z
      .object({ title: z.string().trim().min(1).max(200).optional(), done: z.boolean().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    const [updated] = await db.update(subtasks).set(parsed.data).where(eq(subtasks.id, subtaskId)).returning();
    res.json(updated);
  }),
);

subtasksRouter.delete(
  "/:subtaskId",
  asyncHandler(async (req, res) => {
    const { subtaskId } = req.params;
    await assertSubtaskAccess(req.userId, subtaskId);
    await db.delete(subtasks).where(eq(subtasks.id, subtaskId));
    res.status(204).end();
  }),
);

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

commentsRouter.delete(
  "/:commentId",
  asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
    if (!comment) return res.status(404).json({ error: "Commentaire introuvable." });
    await assertTaskAccess(req.userId, comment.taskId);
    await db.delete(comments).where(eq(comments.id, commentId));
    res.status(204).end();
  }),
);
