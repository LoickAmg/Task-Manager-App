<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const auth = useAuthStore();
const router = useRouter();

const showTopbar = computed(() => auth.isAuthenticated);

async function handleLogout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showTopbar" class="topbar">
      <router-link to="/" class="brand">🗂️ Task Manager</router-link>
      <div class="topbar-user">
        <span>{{ auth.user?.name }}</span>
        <button class="btn-ghost" @click="handleLogout">Déconnexion</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>
