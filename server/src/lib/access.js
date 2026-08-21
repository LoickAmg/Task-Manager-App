import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { boardMembers, lists, tasks } from "../db/schema.js";

// Un utilisateur a accès à un board s'il figure dans `boardMembers`.
// Mono-utilisateur aujourd'hui (un seul compte, toujours "owner"), mais
// cette vérification reste correcte le jour où d'autres membres sont ajoutés.
export async function getBoardMembership(userId, boardId) {
  const [membership] = await db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
  return membership ?? null;
}

export async function assertBoardAccess(userId, boardId) {
  const membership = await getBoardMembership(userId, boardId);
  if (!membership) {
    const error = new Error("Board introuvable.");
    error.status = 404;
    throw error;
  }
  return membership;
}

// Résout le board parent d'une liste, pour vérifier l'accès avant toute
// opération sur une tâche/liste sans redemander le boardId au client.
export async function getBoardIdForList(listId) {
  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, listId));
  return list?.boardId ?? null;
}

export async function getBoardIdForTask(taskId) {
  const [row] = await db
    .select({ boardId: lists.boardId })
    .from(tasks)
    .innerJoin(lists, eq(tasks.listId, lists.id))
    .where(eq(tasks.id, taskId));
  return row?.boardId ?? null;
}
