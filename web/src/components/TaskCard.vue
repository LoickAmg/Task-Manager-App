<script setup>
const props = defineProps({
  task: { type: Object, required: true },
});

const emit = defineEmits(["open", "dragstart-task"]);

const priorityLabel = { low: "Basse", medium: "Moyenne", high: "Haute" };

function subtaskProgress(task) {
  if (!task.subtasks?.length) return null;
  const done = task.subtasks.filter((s) => s.done).length;
  return `${done}/${task.subtasks.length}`;
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function handleDragStart(event) {
  event.dataTransfer.setData("text/plain", props.task.id);
  event.dataTransfer.effectAllowed = "move";
  emit("dragstart-task", props.task.id);
}
</script>

<template>
  <article
    class="task-card"
    :class="`priority-${task.priority}`"
    draggable="true"
    @dragstart="handleDragStart"
    @click="emit('open', task.id)"
  >
    <p class="task-title">{{ task.title }}</p>

    <div v-if="task.tags?.length" class="task-tags">
      <span v-for="tag in task.tags" :key="tag.id" class="tag-chip" :style="{ background: tag.color }">
        {{ tag.name }}
      </span>
    </div>

    <div class="task-meta">
      <span class="priority-dot" :title="priorityLabel[task.priority]"></span>
      <span v-if="formatDueDate(task.dueDate)" class="due-date">📅 {{ formatDueDate(task.dueDate) }}</span>
      <span v-if="subtaskProgress(task)" class="subtask-progress">☑ {{ subtaskProgress(task) }}</span>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-dim);
  border-radius: var(--radius);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.5rem;
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.task-card:active {
  cursor: grabbing;
}

.task-card.priority-low {
  border-left-color: var(--text-dim);
}
.task-card.priority-medium {
  border-left-color: var(--accent);
}
.task-card.priority-high {
  border-left-color: var(--danger);
}

.task-title {
  margin: 0;
  font-size: 0.9rem;
  word-break: break-word;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-dim);
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.priority-low .priority-dot {
  background: var(--text-dim);
}
.priority-medium .priority-dot {
  background: var(--accent);
}
.priority-high .priority-dot {
  background: var(--danger);
}
</style>
