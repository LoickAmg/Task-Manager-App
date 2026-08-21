import { defineStore } from "pinia";
import { api } from "@/lib/api.js";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    status: "idle", // idle | loading | ready
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
  },
  actions: {
    async fetchCurrentUser() {
      this.status = "loading";
      try {
        this.user = await api.get("/auth/me");
      } catch {
        this.user = null;
      } finally {
        this.status = "ready";
      }
    },
    async login(email, password) {
      this.user = await api.post("/auth/login", { email, password });
    },
    async logout() {
      await api.post("/auth/logout");
      this.user = null;
    },
  },
});
