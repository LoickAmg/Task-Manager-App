<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const email = ref("");
const password = ref("");
const error = ref(null);
const loading = ref(false);

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function handleSubmit() {
  error.value = null;
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push(route.query.redirect || { name: "boards" });
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="card login-card" @submit.prevent="handleSubmit">
      <h1>🗂️ Task Manager</h1>
      <p v-if="error" class="error-banner">{{ error }}</p>
      <label>
        Email
        <input v-model="email" type="email" required autofocus />
      </label>
      <label>
        Mot de passe
        <input v-model="password" type="password" required />
      </label>
      <button type="submit" :disabled="loading">{{ loading ? "Connexion…" : "Se connecter" }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 320px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-card h1 {
  margin: 0 0 0.5rem;
  font-size: 1.3rem;
  text-align: center;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}
</style>
