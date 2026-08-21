import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "@/stores/auth.js";
import { api } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetchCurrentUser met user à null si /me échoue (non authentifié)", async () => {
    const store = useAuthStore();
    api.get.mockRejectedValue(new Error("401"));

    await store.fetchCurrentUser();

    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.status).toBe("ready");
  });

  it("login stocke l'utilisateur renvoyé par l'API", async () => {
    const store = useAuthStore();
    api.post.mockResolvedValue({ id: "u1", email: "a@b.com", name: "A" });

    await store.login("a@b.com", "secret");

    expect(store.isAuthenticated).toBe(true);
    expect(store.user.email).toBe("a@b.com");
  });

  it("logout vide l'utilisateur courant", async () => {
    const store = useAuthStore();
    store.user = { id: "u1" };
    api.post.mockResolvedValue(null);

    await store.logout();

    expect(store.user).toBeNull();
  });
});
