import { describe, it, expect, beforeEach } from "vitest";
import { loginAsNewUser } from "./helpers.js";

async function setupBoardWithTwoLists(agent) {
  const board = (await agent.post("/api/boards").send({ name: "Board" })).body;
  const listA = (await agent.post(`/api/boards/${board.id}/lists`).send({ name: "A" })).body;
  const listB = (await agent.post(`/api/boards/${board.id}/lists`).send({ name: "B" })).body;
  return { board, listA, listB };
}

async function addTask(agent, listId, title) {
  return (await agent.post(`/api/lists/${listId}/tasks`).send({ title })).body;
}

async function tasksOf(agent, boardId, listId) {
  const detail = await agent.get(`/api/boards/${boardId}`);
  const list = detail.body.lists.find((l) => l.id === listId);
  return [...list.tasks].sort((a, b) => a.position - b.position);
}

describe("tasks", () => {
  let ctx;

  beforeEach(async () => {
    const { agent, user } = await loginAsNewUser();
    const { board, listA, listB } = await setupBoardWithTwoLists(agent);
    ctx = { agent, user, board, listA, listB };
  });

  it("crée une tâche avec la position suivante disponible", async () => {
    const { agent, listA } = ctx;
    const t1 = await addTask(agent, listA.id, "Une");
    const t2 = await addTask(agent, listA.id, "Deux");
    expect(t1.position).toBe(0);
    expect(t2.position).toBe(1);
  });

  it("met à jour le titre/priorité d'une tâche", async () => {
    const { agent, listA } = ctx;
    const t1 = await addTask(agent, listA.id, "Une");
    const res = await agent.patch(`/api/tasks/${t1.id}`).send({ title: "Modifiée", priority: "high" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Modifiée");
    expect(res.body.priority).toBe("high");
  });

  it("déplace une tâche vers une autre liste et recale les positions des deux côtés", async () => {
    const { agent, board, listA, listB } = ctx;
    const a1 = await addTask(agent, listA.id, "a1");
    await addTask(agent, listA.id, "a2");
    await addTask(agent, listA.id, "a3");
    await addTask(agent, listB.id, "b1");

    await agent.post(`/api/tasks/${a1.id}/move`).send({ listId: listB.id, position: 0 }).expect(200);

    const remainingA = await tasksOf(agent, board.id, listA.id);
    expect(remainingA.map((t) => t.title)).toEqual(["a2", "a3"]);
    expect(remainingA.map((t) => t.position)).toEqual([0, 1]);

    const nowB = await tasksOf(agent, board.id, listB.id);
    expect(nowB.map((t) => t.title)).toEqual(["a1", "b1"]);
    expect(nowB.map((t) => t.position)).toEqual([0, 1]);
  });

  it("réordonne au sein de la même liste", async () => {
    const { agent, board, listA } = ctx;
    const a1 = await addTask(agent, listA.id, "a1");
    await addTask(agent, listA.id, "a2");
    const a3 = await addTask(agent, listA.id, "a3");

    // Déplace a3 (position 2) en tête de liste.
    await agent.post(`/api/tasks/${a3.id}/move`).send({ listId: listA.id, position: 0 }).expect(200);

    const ordered = await tasksOf(agent, board.id, listA.id);
    expect(ordered.map((t) => t.title)).toEqual(["a3", "a1", "a2"]);
    expect(a1.position).toBe(0); // valeur avant déplacement, juste pour lisibilité du test
  });

  it("attache puis détache un tag d'une tâche", async () => {
    const { agent, board, listA } = ctx;
    const tag = (await agent.post(`/api/boards/${board.id}/tags`).send({ name: "Bug" })).body;
    const task = await addTask(agent, listA.id, "Une");

    await agent.post(`/api/tasks/${task.id}/tags`).send({ tagId: tag.id }).expect(201);
    let detail = await agent.get(`/api/boards/${board.id}`);
    let found = detail.body.lists[0].tasks.find((t) => t.id === task.id);
    expect(found.tags.map((t) => t.id)).toEqual([tag.id]);

    await agent.delete(`/api/tasks/${task.id}/tags/${tag.id}`).expect(204);
    detail = await agent.get(`/api/boards/${board.id}`);
    found = detail.body.lists[0].tasks.find((t) => t.id === task.id);
    expect(found.tags).toEqual([]);
  });

  it("ajoute, coche et supprime une sous-tâche", async () => {
    const { agent, listA } = ctx;
    const task = await addTask(agent, listA.id, "Une");

    const sub = (await agent.post(`/api/tasks/${task.id}/subtasks`).send({ title: "Étape 1" }).expect(201)).body;
    expect(sub.done).toBe(false);

    const updated = await agent.patch(`/api/subtasks/${sub.id}`).send({ done: true });
    expect(updated.body.done).toBe(true);

    await agent.delete(`/api/subtasks/${sub.id}`).expect(204);
  });

  it("ajoute et liste des commentaires", async () => {
    const { agent, listA } = ctx;
    const task = await addTask(agent, listA.id, "Une");

    await agent.post(`/api/tasks/${task.id}/comments`).send({ body: "Premier" }).expect(201);
    await agent.post(`/api/tasks/${task.id}/comments`).send({ body: "Second" }).expect(201);

    const res = await agent.get(`/api/tasks/${task.id}/comments`).expect(200);
    expect(res.body.map((c) => c.body)).toEqual(["Premier", "Second"]);
  });

  it("refuse toute opération sur une tâche d'un board qui n'appartient pas à l'utilisateur", async () => {
    const { listA } = ctx;
    const task = await addTask(ctx.agent, listA.id, "Une");

    const { agent: otherAgent } = await loginAsNewUser({ email: "intrus@example.com" });
    await otherAgent.patch(`/api/tasks/${task.id}`).send({ title: "Hack" }).expect(404);
    await otherAgent.delete(`/api/tasks/${task.id}`).expect(404);
  });
});
