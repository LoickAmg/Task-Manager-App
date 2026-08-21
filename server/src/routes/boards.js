import { Router } from "express";
import { z } from "zod";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { boards, boardMembers, lists, tasks, tags, taskTags, subtasks } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { assertBoardAccess, getBoardIdForList } from "../lib/access.js";

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});

const updateBoardSchema = createBoardSchema.partial();

const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const updateListSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  position: z.number().int().min(0).optional(),
});

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

boardsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ board: boards, role: boardMembers.role })
      .from(boardMembers)
      .innerJoin(boards, eq(boardMembers.boardId, boards.id))
      .where(eq(boardMembers.userId, req.userId))
      .orderBy(asc(boards.createdAt));

    res.json(rows.map(({ board, role }) => ({ ...board, role })));
  }),
);

boardsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Nom de board invalide." });

    const [board] = await db
      .insert(boards)
      .values({ ...parsed.data, ownerId: req.userId })
      .returning();

    await db.insert(boardMembers).values({ boardId: board.id, userId: req.userId, role: "owner" });

    res.status(201).json({ ...board, role: "owner" });
  }),
);

boardsRouter.get(
  "/:boardId",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);

    const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
    if (!board) return res.status(404).json({ error: "Board introuvable." });

    const boardLists = await db
      .select()
      .from(lists)
      .where(eq(lists.boardId, boardId))
      .orderBy(asc(lists.position));

    const listIds = boardLists.map((l) => l.id);

    const boardTasks = listIds.length
      ? await db.select().from(tasks).where(inArray(tasks.listId, listIds)).orderBy(asc(tasks.position))
      : [];

    const taskIds = boardTasks.map((t) => t.id);

    const [taskTagRows, taskSubtasks, boardTags] = await Promise.all([
      taskIds.length
        ? db
            .select({ taskId: taskTags.taskId, tag: tags })
            .from(taskTags)
            .innerJoin(tags, eq(taskTags.tagId, tags.id))
            .where(inArray(taskTags.taskId, taskIds))
        : [],
      taskIds.length
        ? db.select().from(subtasks).where(inArray(subtasks.taskId, taskIds)).orderBy(asc(subtasks.position))
        : [],
      db.select().from(tags).where(eq(tags.boardId, boardId)).orderBy(asc(tags.name)),
    ]);

    const tagsByTask = new Map();
    for (const { taskId, tag } of taskTagRows) {
      if (!tagsByTask.has(taskId)) tagsByTask.set(taskId, []);
      tagsByTask.get(taskId).push(tag);
    }

    const subtasksByTask = new Map();
    for (const subtask of taskSubtasks) {
      if (!subtasksByTask.has(subtask.taskId)) subtasksByTask.set(subtask.taskId, []);
      subtasksByTask.get(subtask.taskId).push(subtask);
    }

    const tasksByList = new Map();
    for (const task of boardTasks) {
      const enriched = {
        ...task,
        tags: tagsByTask.get(task.id) ?? [],
        subtasks: subtasksByTask.get(task.id) ?? [],
      };
      if (!tasksByList.has(task.listId)) tasksByList.set(task.listId, []);
      tasksByList.get(task.listId).push(enriched);
    }

    res.json({
      ...board,
      tags: boardTags,
      lists: boardLists.map((list) => ({ ...list, tasks: tasksByList.get(list.id) ?? [] })),
    });
  }),
);

boardsRouter.patch(
  "/:boardId",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);

    const parsed = updateBoardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    const [updated] = await db
      .update(boards)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(boards.id, boardId))
      .returning();

    res.json(updated);
  }),
);

boardsRouter.delete(
  "/:boardId",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);
    await db.delete(boards).where(eq(boards.id, boardId));
    res.status(204).end();
  }),
);

boardsRouter.post(
  "/:boardId/lists",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);

    const parsed = createListSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Nom de liste invalide." });

    const existing = await db.select().from(lists).where(eq(lists.boardId, boardId));
    const position = existing.length;

    const [list] = await db
      .insert(lists)
      .values({ ...parsed.data, boardId, position })
      .returning();

    res.status(201).json({ ...list, tasks: [] });
  }),
);

boardsRouter.patch(
  "/:boardId/lists",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);

    const parsed = z.object({ orderedIds: z.array(z.string()).min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ordre invalide." });

    await db.transaction(async (tx) => {
      for (const [position, listId] of parsed.data.orderedIds.entries()) {
        await tx.update(lists).set({ position }).where(and(eq(lists.id, listId), eq(lists.boardId, boardId)));
      }
    });

    res.status(204).end();
  }),
);

boardsRouter.post(
  "/:boardId/tags",
  asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    await assertBoardAccess(req.userId, boardId);

    const parsed = createTagSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Tag invalide." });

    const [tag] = await db
      .insert(tags)
      .values({ ...parsed.data, boardId })
      .returning();

    res.status(201).json(tag);
  }),
);

// Routes indépendantes du préfixe /boards/:boardId (l'accès est résolu via
// la liste/le tag lui-même) — montées séparément dans index.js sous /api.
export const listsRouter = Router();
listsRouter.use(requireAuth);

listsRouter.patch(
  "/:listId",
  asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const boardId = await getBoardIdForList(listId);
    if (!boardId) return res.status(404).json({ error: "Liste introuvable." });
    await assertBoardAccess(req.userId, boardId);

    const parsed = updateListSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    const [updated] = await db.update(lists).set(parsed.data).where(eq(lists.id, listId)).returning();
    res.json(updated);
  }),
);

listsRouter.delete(
  "/:listId",
  asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const boardId = await getBoardIdForList(listId);
    if (!boardId) return res.status(404).json({ error: "Liste introuvable." });
    await assertBoardAccess(req.userId, boardId);

    await db.delete(lists).where(eq(lists.id, listId));
    res.status(204).end();
  }),
);

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

tagsRouter.delete(
  "/:tagId",
  asyncHandler(async (req, res) => {
    const { tagId } = req.params;
    const [tag] = await db.select().from(tags).where(eq(tags.id, tagId));
    if (!tag) return res.status(404).json({ error: "Tag introuvable." });
    await assertBoardAccess(req.userId, tag.boardId);

    await db.delete(tags).where(eq(tags.id, tagId));
    res.status(204).end();
  }),
);
