import { describe, it, expect } from "vitest";
import { loginAsNewUser } from "./helpers.js";

async function createBoard(agent, name = "Projet test") {
  const res = await agent.post("/api/boards").send({ name }).expect(201);
  return res.body;
}

describe("boards", () => {
  it("crée un board et le renvoie dans la liste avec le rôle owner", async () => {
    const { agent } = await loginAsNewUser();
    const board = await createBoard(agent);
    expect(board.role).toBe("owner");

    const list = await agent.get("/api/boards").expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(board.id);
  });

  it("rejette un nom de board vide", async () => {
    const { agent } = await loginAsNewUser();
    const res = await agent.post("/api/boards").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("refuse l'accès à un board d'un autre utilisateur", async () => {
    const owner = await loginAsNewUser({ email: "owner@example.com" });
    const board = await createBoard(owner.agent);

    const other = await loginAsNewUser({ email: "other@example.com" });
    const res = await other.agent.get(`/api/boards/${board.id}`);
    expect(res.status).toBe(404);
  });

  it("board detail renvoie les listes, tâches, tags imbriqués", async () => {
    const { agent } = await loginAsNewUser();
    const board = await createBoard(agent);
    await agent.post(`/api/boards/${board.id}/lists`).send({ name: "À faire" }).expect(201);

    const detail = await agent.get(`/api/boards/${board.id}`).expect(200);
    expect(detail.body.lists).toHaveLength(1);
    expect(detail.body.lists[0].tasks).toEqual([]);
    expect(detail.body.tags).toEqual([]);
  });

  it("réordonne les listes d'un board", async () => {
    const { agent } = await loginAsNewUser();
    const board = await createBoard(agent);
    const l1 = (await agent.post(`/api/boards/${board.id}/lists`).send({ name: "A" })).body;
    const l2 = (await agent.post(`/api/boards/${board.id}/lists`).send({ name: "B" })).body;

    await agent.patch(`/api/boards/${board.id}/lists`).send({ orderedIds: [l2.id, l1.id] }).expect(204);

    const detail = await agent.get(`/api/boards/${board.id}`).expect(200);
    expect(detail.body.lists.map((l) => l.id)).toEqual([l2.id, l1.id]);
  });

  it("crée et supprime un tag", async () => {
    const { agent } = await loginAsNewUser();
    const board = await createBoard(agent);
    const tag = (await agent.post(`/api/boards/${board.id}/tags`).send({ name: "Urgent" }).expect(201)).body;

    await agent.delete(`/api/tags/${tag.id}`).expect(204);
    const detail = await agent.get(`/api/boards/${board.id}`).expect(200);
    expect(detail.body.tags).toEqual([]);
  });

  it("supprime un board (cascade sur les listes)", async () => {
    const { agent } = await loginAsNewUser();
    const board = await createBoard(agent);
    await agent.post(`/api/boards/${board.id}/lists`).send({ name: "À faire" }).expect(201);

    await agent.delete(`/api/boards/${board.id}`).expect(204);
    await agent.get(`/api/boards/${board.id}`).expect(404);
  });
});
