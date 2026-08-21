<script setup>
import { ref, onMounted } from "vue";
import { useBoardStore } from "@/stores/board.js";

const store = useBoardStore();
const newBoardName = ref("");
const creating = ref(false);
const error = ref(null);

onMounted(() => store.fetchBoards());

async function handleCreate() {
  if (!newBoardName.value.trim()) return;
  creating.value = true;
  error.value = null;
  try {
    await store.createBoard(newBoardName.value.trim());
    newBoardName.value = "";
  } catch (err) {
    error.value = err.message;
  } finally {
    creating.value = false;
  }
}

async function handleDelete(boardId) {
  if (!confirm("Supprimer ce board et tout son contenu ?")) return;
  await store.deleteBoard(boardId);
}
</script>

<template>
  <div class="boards-page">
    <h1>Mes boards</h1>
    <p v-if="error" class="error-banner">{{ error }}</p>

    <form class="new-board-form card" @submit.prevent="handleCreate">
      <input v-model="newBoardName" type="text" placeholder="Nom du nouveau board…" />
      <button type="submit" :disabled="creating">+ Créer</button>
    </form>

    <div class="boards-grid">
      <div v-for="board in store.boards" :key="board.id" class="card board-card">
        <router-link :to="{ name: 'board', params: { boardId: board.id } }" class="board-link">
          <h2>{{ board.name }}</h2>
          <p v-if="board.description">{{ board.description }}</p>
        </router-link>
        <button class="btn-ghost btn-icon" title="Supprimer" @click="handleDelete(board.id)">🗑️</button>
      </div>
      <p v-if="!store.boards.length" class="empty-hint">
        Aucun board pour l'instant — crée le premier ci-dessus.
      </p>
    </div>
  </div>
</template>

<style scoped>
.boards-page {
  max-width: 900px;
  margin: 0 auto;
}

.new-board-form {
  display: flex;
  gap: 0.6rem;
  padding: 1rem;
  margin: 1rem 0 1.5rem;
}

.new-board-form input {
  flex: 1;
}

.boards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.board-card {
  padding: 1.1rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.board-link {
  color: inherit;
  text-decoration: none;
  flex: 1;
}

.board-link h2 {
  margin: 0 0 0.3rem;
  font-size: 1.05rem;
}

.board-link p {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.empty-hint {
  color: var(--text-dim);
}
</style>
