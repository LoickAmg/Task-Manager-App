<script setup>
import { ref } from "vue";
import TaskCard from "./TaskCard.vue";

const props = defineProps({
  list: { type: Object, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
});

const emit = defineEmits([
  "open-task",
  "drop-task",
  "add-task",
  "rename",
  "delete",
  "move-left",
  "move-right",
]);

const tasksContainer = ref(null);
const dragOverIndex = ref(null);
const editingName = ref(false);
const nameDraft = ref(props.list.name);
const addingTask = ref(false);
const newTaskTitle = ref("");

function orderedTasks() {
  return [...props.list.tasks].sort((a, b) => a.position - b.position);
}

function indexFromPointerY(clientY) {
  const cards = tasksContainer.value?.querySelectorAll(".task-card") ?? [];
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return cards.length;
}

function handleDragOver(event) {
  event.preventDefault();
  dragOverIndex.value = indexFromPointerY(event.clientY);
}

function handleDragLeave(event) {
  if (!tasksContainer.value?.contains(event.relatedTarget)) {
    dragOverIndex.value = null;
  }
}

function handleDrop(event) {
  event.preventDefault();
  const taskId = event.dataTransfer.getData("text/plain");
  const position = dragOverIndex.value ?? orderedTasks().length;
  dragOverIndex.value = null;
  if (taskId) emit("drop-task", { taskId, listId: props.list.id, position });
}

function commitRename() {
  editingName.value = false;
  const trimmed = nameDraft.value.trim();
  if (trimmed && trimmed !== props.list.name) emit("rename", trimmed);
  else nameDraft.value = props.list.name;
}

function submitNewTask() {
  const title = newTaskTitle.value.trim();
  if (!title) {
    addingTask.value = false;
    return;
  }
  emit("add-task", title);
  newTaskTitle.value = "";
}
</script>

<template>
  <section class="column">
    <header class="column-header">
      <input
        v-if="editingName"
        v-model="nameDraft"
        class="name-input"
        autofocus
        @blur="commitRename"
        @keyup.enter="commitRename"
        @keyup.esc="editingName = false"
      />
      <h3 v-else class="column-title" @click="editingName = true">{{ list.name }}</h3>
      <span class="task-count">{{ list.tasks.length }}</span>
    </header>

    <div class="column-actions">
      <button class="btn-ghost btn-icon" :disabled="isFirst" title="Déplacer à gauche" @click="emit('move-left')">
        ←
      </button>
      <button class="btn-ghost btn-icon" :disabled="isLast" title="Déplacer à droite" @click="emit('move-right')">
        →
      </button>
      <button class="btn-ghost btn-icon" title="Supprimer la liste" @click="emit('delete')">🗑️</button>
    </div>

    <div
      ref="tasksContainer"
      class="tasks-dropzone"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <template v-for="(task, index) in orderedTasks()" :key="task.id">
        <div v-if="dragOverIndex === index" class="drop-indicator"></div>
        <TaskCard :task="task" @open="emit('open-task', task.id)" />
      </template>
      <div v-if="dragOverIndex === orderedTasks().length" class="drop-indicator"></div>
      <p v-if="!list.tasks.length && dragOverIndex === null" class="empty-column">Aucune tâche</p>
    </div>

    <form v-if="addingTask" class="new-task-form" @submit.prevent="submitNewTask">
      <input v-model="newTaskTitle" type="text" placeholder="Titre de la tâche…" autofocus @blur="submitNewTask" />
    </form>
    <button v-else class="btn-ghost add-task-btn" @click="addingTask = true">+ Ajouter une tâche</button>
  </section>
</template>

<style scoped>
.column {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  padding: 0.75rem;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.column-title {
  margin: 0;
  font-size: 0.95rem;
  cursor: text;
  flex: 1;
}

.name-input {
  flex: 1;
}

.task-count {
  color: var(--text-dim);
  font-size: 0.8rem;
}

.column-actions {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
}

.tasks-dropzone {
  flex: 1;
  overflow-y: auto;
  min-height: 40px;
}

.drop-indicator {
  height: 3px;
  border-radius: 2px;
  background: var(--accent);
  margin-bottom: 0.5rem;
}

.empty-column {
  color: var(--text-dim);
  font-size: 0.8rem;
  text-align: center;
  padding: 1rem 0;
}

.add-task-btn {
  width: 100%;
  background: transparent;
  color: var(--text-dim);
  border: 1px dashed var(--border);
  margin-top: 0.4rem;
}

.new-task-form {
  margin-top: 0.4rem;
}
</style>
