<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useBoardStore } from "@/stores/board.js";
import { useAuthStore } from "@/stores/auth.js";
import { api } from "@/lib/api.js";

const props = defineProps({
  taskId: { type: String, required: true },
});
const emit = defineEmits(["close", "deleted"]);

const store = useBoardStore();
const auth = useAuthStore();

const task = computed(() => store.findTask(props.taskId));
const boardTags = computed(() => store.current?.tags ?? []);

const titleDraft = ref("");
const descriptionDraft = ref("");

const newSubtaskTitle = ref("");
const newComment = ref("");
const comments = ref([]);
const loadingComments = ref(false);

function syncDraftsFromTask() {
  if (!task.value) return;
  titleDraft.value = task.value.title;
  descriptionDraft.value = task.value.description ?? "";
}

onMounted(syncDraftsFromTask);
watch(() => task.value?.id, syncDraftsFromTask);

async function loadComments() {
  loadingComments.value = true;
  try {
    comments.value = await api.get(`/tasks/${props.taskId}/comments`);
  } finally {
    loadingComments.value = false;
  }
}
onMounted(loadComments);

async function saveTitle() {
  const trimmed = titleDraft.value.trim();
  if (!trimmed || trimmed === task.value.title) {
    titleDraft.value = task.value.title;
    return;
  }
  await store.updateTask(props.taskId, { title: trimmed });
}

async function saveDescription() {
  const trimmed = descriptionDraft.value.trim();
  await store.updateTask(props.taskId, { description: trimmed || null });
}

async function savePriority(event) {
  await store.updateTask(props.taskId, { priority: event.target.value });
}

const dueDateInput = computed({
  get: () => (task.value?.dueDate ? task.value.dueDate.slice(0, 10) : ""),
  set: async (value) => {
    const dueDate = value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
    await store.updateTask(props.taskId, { dueDate });
  },
});

function hasTag(tagId) {
  return task.value.tags.some((t) => t.id === tagId);
}

async function toggleTag(tag) {
  if (hasTag(tag.id)) await store.detachTag(props.taskId, tag.id);
  else await store.attachTag(props.taskId, tag.id);
}

async function addSubtask() {
  const title = newSubtaskTitle.value.trim();
  if (!title) return;
  await store.addSubtask(props.taskId, title);
  newSubtaskTitle.value = "";
}

async function submitComment() {
  const body = newComment.value.trim();
  if (!body) return;
  const comment = await api.post(`/tasks/${props.taskId}/comments`, { body });
  comments.value.push(comment);
  newComment.value = "";
}

async function removeComment(commentId) {
  await api.delete(`/comments/${commentId}`);
  comments.value = comments.value.filter((c) => c.id !== commentId);
}

async function handleDelete() {
  if (!confirm("Supprimer cette tâche ?")) return;
  await store.deleteTask(props.taskId);
  emit("deleted");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
</script>

<template>
  <div v-if="task" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal card">
      <header class="modal-header">
        <input
          v-model="titleDraft"
          class="title-input"
          @blur="saveTitle"
          @keyup.enter="$event.target.blur()"
        />
        <button class="btn-ghost btn-icon" title="Fermer" @click="emit('close')">✕</button>
      </header>

      <div class="modal-body">
        <label class="field">
          <span>Description</span>
          <textarea
            v-model="descriptionDraft"
            rows="3"
            placeholder="Ajouter une description…"
            @blur="saveDescription"
          ></textarea>
        </label>

        <div class="field-row">
          <label class="field">
            <span>Priorité</span>
            <select :value="task.priority" @change="savePriority">
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </label>

          <label class="field">
            <span>Échéance</span>
            <input v-model="dueDateInput" type="date" />
          </label>
        </div>

        <div class="field">
          <span>Tags</span>
          <div class="tags-picker">
            <button
              v-for="tag in boardTags"
              :key="tag.id"
              type="button"
              class="tag-chip tag-toggle"
              :class="{ inactive: !hasTag(tag.id) }"
              :style="{ background: tag.color }"
              @click="toggleTag(tag)"
            >
              {{ tag.name }}
            </button>
            <p v-if="!boardTags.length" class="hint">Aucun tag sur ce board.</p>
          </div>
        </div>

        <div class="field">
          <span>Sous-tâches</span>
          <ul class="subtasks-list">
            <li v-for="sub in task.subtasks" :key="sub.id">
              <label>
                <input
                  type="checkbox"
                  :checked="sub.done"
                  @change="store.toggleSubtask(taskId, sub.id, $event.target.checked)"
                />
                <span :class="{ done: sub.done }">{{ sub.title }}</span>
              </label>
              <button class="btn-ghost btn-icon" title="Supprimer" @click="store.deleteSubtask(taskId, sub.id)">
                ✕
              </button>
            </li>
          </ul>
          <form class="inline-form" @submit.prevent="addSubtask">
            <input v-model="newSubtaskTitle" type="text" placeholder="Nouvelle sous-tâche…" />
            <button type="submit">Ajouter</button>
          </form>
        </div>

        <div class="field">
          <span>Commentaires</span>
          <ul class="comments-list">
            <li v-for="comment in comments" :key="comment.id">
              <div class="comment-meta">
                <strong>{{ auth.user?.name }}</strong>
                <time>{{ formatDateTime(comment.createdAt) }}</time>
                <button class="btn-ghost btn-icon" title="Supprimer" @click="removeComment(comment.id)">✕</button>
              </div>
              <p>{{ comment.body }}</p>
            </li>
            <p v-if="!loadingComments && !comments.length" class="hint">Aucun commentaire.</p>
          </ul>
          <form class="inline-form" @submit.prevent="submitComment">
            <input v-model="newComment" type="text" placeholder="Écrire un commentaire…" />
            <button type="submit">Envoyer</button>
          </form>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn-danger" @click="handleDelete">Supprimer la tâche</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3rem 1rem;
  overflow-y: auto;
  z-index: 20;
}

.modal {
  width: 100%;
  max-width: 560px;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--border);
}

.title-input {
  flex: 1;
  font-size: 1.05rem;
  font-weight: 600;
  background: transparent;
  border: none;
  padding: 0.2rem 0;
}

.title-input:focus {
  outline: none;
  border-bottom: 1px solid var(--accent);
}

.modal-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  max-height: 65vh;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field > span {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.field-row {
  display: flex;
  gap: 1rem;
}

.field-row .field {
  flex: 1;
}

.tags-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag-toggle {
  border: none;
  cursor: pointer;
}

.tag-toggle.inactive {
  opacity: 0.35;
}

.hint {
  color: var(--text-dim);
  font-size: 0.8rem;
  margin: 0;
}

.subtasks-list,
.comments-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.subtasks-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.subtasks-list label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.subtasks-list .done {
  text-decoration: line-through;
  color: var(--text-dim);
}

.comments-list li {
  background: var(--bg-elevated);
  border-radius: var(--radius);
  padding: 0.5rem 0.7rem;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-bottom: 0.2rem;
}

.comment-meta button {
  margin-left: auto;
}

.comments-list p {
  margin: 0;
  font-size: 0.9rem;
}

.inline-form {
  display: flex;
  gap: 0.5rem;
}

.inline-form input {
  flex: 1;
}

.modal-footer {
  padding: 1rem 1.2rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
