<script setup>
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useBoardStore } from "@/stores/board.js";
import KanbanColumn from "@/components/KanbanColumn.vue";
import TaskDetailModal from "@/components/TaskDetailModal.vue";

const route = useRoute();
const store = useBoardStore();

const newListName = ref("");
const selectedTaskId = ref(null);
const newTagName = ref("");
const newTagColor = ref("#6ea8fe");
const showTagForm = ref(false);

async function load() {
  await store.loadBoard(route.params.boardId);
}

onMounted(load);
watch(() => route.params.boardId, load);

function orderedLists() {
  return [...(store.current?.lists ?? [])].sort((a, b) => a.position - b.position);
}

async function handleCreateList() {
  const name = newListName.value.trim();
  if (!name) return;
  await store.createList(name);
  newListName.value = "";
}

async function handleDropTask({ taskId, listId, position }) {
  await store.moveTask(taskId, listId, position);
}

async function handleCreateTag() {
  const name = newTagName.value.trim();
  if (!name) return;
  await store.createTag(name, newTagColor.value);
  newTagName.value = "";
  showTagForm.value = false;
}

function handleTaskDeleted() {
  selectedTaskId.value = null;
}
</script>

<template>
  <div class="board-page">
    <div v-if="store.loading" class="loading-hint">Chargement du board…</div>
    <div v-else-if="store.error" class="error-banner">{{ store.error }}</div>

    <template v-else-if="store.current">
      <header class="board-header">
        <div>
          <h1>{{ store.current.name }}</h1>
          <p v-if="store.current.description">{{ store.current.description }}</p>
        </div>
        <div class="board-tags">
          <span
            v-for="tag in store.current.tags"
            :key="tag.id"
            class="tag-chip"
            :style="{ background: tag.color }"
          >
            {{ tag.name }}
            <button class="tag-remove" title="Supprimer le tag" @click="store.deleteTag(tag.id)">✕</button>
          </span>
          <form v-if="showTagForm" class="new-tag-form" @submit.prevent="handleCreateTag">
            <input v-model="newTagName" type="text" placeholder="Nom du tag" autofocus />
            <input v-model="newTagColor" type="color" />
            <button type="submit">OK</button>
          </form>
          <button v-else class="btn-ghost" @click="showTagForm = true">+ Tag</button>
        </div>
      </header>

      <div class="columns-row">
        <KanbanColumn
          v-for="(list, index) in orderedLists()"
          :key="list.id"
          :list="list"
          :is-first="index === 0"
          :is-last="index === orderedLists().length - 1"
          @open-task="selectedTaskId = $event"
          @drop-task="handleDropTask"
          @add-task="(title) => store.createTask(list.id, title)"
          @rename="(name) => store.renameList(list.id, name)"
          @delete="store.deleteList(list.id)"
          @move-left="store.moveListLeft(list.id)"
          @move-right="store.moveListRight(list.id)"
        />

        <form class="new-list-form card" @submit.prevent="handleCreateList">
          <input v-model="newListName" type="text" placeholder="+ Nouvelle liste" />
        </form>
      </div>

      <TaskDetailModal
        v-if="selectedTaskId"
        :task-id="selectedTaskId"
        @close="selectedTaskId = null"
        @deleted="handleTaskDeleted"
      />
    </template>
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.loading-hint {
  color: var(--text-dim);
}

.board-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.2rem;
}

.board-header h1 {
  margin: 0 0 0.2rem;
}

.board-header p {
  margin: 0;
  color: var(--text-dim);
}

.board-tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag-remove {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: 0.7rem;
  opacity: 0.7;
}

.new-tag-form {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.new-tag-form input[type="text"] {
  width: 120px;
}

.new-tag-form input[type="color"] {
  width: 36px;
  padding: 0;
  height: 32px;
}

.columns-row {
  display: flex;
  gap: 1rem;
  flex: 1;
  overflow-x: auto;
  align-items: flex-start;
  padding-bottom: 1rem;
}

.new-list-form {
  width: 240px;
  min-width: 240px;
  padding: 0.75rem;
}

.new-list-form input {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-dim);
}
</style>
