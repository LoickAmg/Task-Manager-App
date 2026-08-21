import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useBoardStore } from "@/stores/board.js";
import { api } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function makeCurrent() {
  return {
    id: "board1",
    tags: [],
    lists: [
      {
        id: "listA",
        position: 0,
        tasks: [
          { id: "a1", title: "a1", position: 0, tags: [], subtasks: [] },
          { id: "a2", title: "a2", position: 1, tags: [], subtasks: [] },
        ],
      },
      { id: "listB", position: 1, tasks: [] },
    ],
  };
}

describe("board store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("createTask ajoute la tâche à la liste ciblée", async () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    api.post.mockResolvedValue({ id: "a3", title: "a3", position: 2, tags: [], subtasks: [] });

    await store.createTask("listA", "a3");

    expect(store.current.lists[0].tasks).toHaveLength(3);
    expect(api.post).toHaveBeenCalledWith("/lists/listA/tasks", { title: "a3" });
  });

  it("moveTask déplace la tâche localement de façon optimiste puis confirme via l'API", async () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    api.post.mockResolvedValue({});
    api.get.mockResolvedValue(makeCurrent());

    const movePromise = store.moveTask("a1", "listB", 0);

    // Optimiste : la tâche a déjà bougé avant même que l'appel réseau ne résolve.
    expect(store.current.lists[0].tasks.map((t) => t.id)).toEqual(["a2"]);
    expect(store.current.lists[1].tasks.map((t) => t.id)).toEqual(["a1"]);

    await movePromise;
    expect(api.post).toHaveBeenCalledWith("/tasks/a1/move", { listId: "listB", position: 0 });
  });

  it("moveTask resynchronise depuis le serveur en cas d'erreur", async () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    api.post.mockRejectedValue(new Error("Conflit"));
    api.get.mockResolvedValue(makeCurrent());

    await store.moveTask("a1", "listB", 0);

    expect(store.error).toBe("Conflit");
    expect(api.get).toHaveBeenCalledWith("/boards/board1");
  });

  it("attachTag puis detachTag mettent à jour les tags de la tâche localement", async () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    const tag = { id: "tag1", name: "Bug", color: "#fff" };
    api.post.mockResolvedValue(tag);
    api.delete.mockResolvedValue(null);

    await store.attachTag("a1", "tag1");
    expect(store.findTask("a1").tags).toEqual([tag]);

    await store.detachTag("a1", "tag1");
    expect(store.findTask("a1").tags).toEqual([]);
  });

  it("findTask retrouve une tâche dans n'importe quelle liste", () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    expect(store.findTask("a2")?.title).toBe("a2");
    expect(store.findTask("inconnu")).toBeNull();
  });

  it("deleteTask retire la tâche de sa liste", async () => {
    const store = useBoardStore();
    store.current = makeCurrent();
    api.delete.mockResolvedValue(null);

    await store.deleteTask("a1");
    expect(store.current.lists[0].tasks.map((t) => t.id)).toEqual(["a2"]);
  });
});
