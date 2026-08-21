import { defineStore } from "pinia";
import { api } from "@/lib/api.js";

export const useBoardStore = defineStore("board", {
  state: () => ({
    boards: [],
    current: null, // board detail { ...board, tags, lists: [{ ...list, tasks }] }
    loading: false,
    error: null,
  }),
  actions: {
    async fetchBoards() {
      this.boards = await api.get("/boards");
    },

    async createBoard(name, description) {
      const board = await api.post("/boards", { name, description });
      this.boards.push(board);
      return board;
    },

    async deleteBoard(boardId) {
      await api.delete(`/boards/${boardId}`);
      this.boards = this.boards.filter((b) => b.id !== boardId);
    },

    async loadBoard(boardId) {
      this.loading = true;
      this.error = null;
      try {
        this.current = await api.get(`/boards/${boardId}`);
      } catch (err) {
        this.error = err.message;
        this.current = null;
      } finally {
        this.loading = false;
      }
    },

    async refreshCurrent() {
      if (this.current) await this.loadBoard(this.current.id);
    },

    async createList(name) {
      const list = await api.post(`/boards/${this.current.id}/lists`, { name });
      this.current.lists.push(list);
    },

    async renameList(listId, name) {
      await api.patch(`/lists/${listId}`, { name });
      const list = this.current.lists.find((l) => l.id === listId);
      if (list) list.name = name;
    },

    async deleteList(listId) {
      await api.delete(`/lists/${listId}`);
      this.current.lists = this.current.lists.filter((l) => l.id !== listId);
    },

    async moveListLeft(listId) {
      const lists = [...this.current.lists].sort((a, b) => a.position - b.position);
      const index = lists.findIndex((l) => l.id === listId);
      if (index <= 0) return;
      [lists[index - 1], lists[index]] = [lists[index], lists[index - 1]];
      this.current.lists = lists;
      await api.patch(`/boards/${this.current.id}/lists`, { orderedIds: lists.map((l) => l.id) });
      await this.refreshCurrent();
    },

    async moveListRight(listId) {
      const lists = [...this.current.lists].sort((a, b) => a.position - b.position);
      const index = lists.findIndex((l) => l.id === listId);
      if (index === -1 || index >= lists.length - 1) return;
      [lists[index], lists[index + 1]] = [lists[index + 1], lists[index]];
      this.current.lists = lists;
      await api.patch(`/boards/${this.current.id}/lists`, { orderedIds: lists.map((l) => l.id) });
      await this.refreshCurrent();
    },

    async createTask(listId, title) {
      const task = await api.post(`/lists/${listId}/tasks`, { title });
      const list = this.current.lists.find((l) => l.id === listId);
      if (list) list.tasks.push(task);
      return task;
    },

    async updateTask(taskId, patch) {
      const updated = await api.patch(`/tasks/${taskId}`, patch);
      this.patchTaskLocally(taskId, updated);
      return updated;
    },

    async deleteTask(taskId) {
      await api.delete(`/tasks/${taskId}`);
      for (const list of this.current.lists) {
        list.tasks = list.tasks.filter((t) => t.id !== taskId);
      }
    },

    // Déplacement optimiste : la carte bouge visuellement tout de suite,
    // l'appel API confirme en arrière-plan. En cas d'erreur, on resynchronise
    // depuis le serveur pour ne jamais laisser l'UI dans un état incohérent.
    async moveTask(taskId, destListId, destPosition) {
      const sourceList = this.current.lists.find((l) => l.tasks.some((t) => t.id === taskId));
      const destList = this.current.lists.find((l) => l.id === destListId);
      if (!sourceList || !destList) return;

      const task = sourceList.tasks.find((t) => t.id === taskId);
      sourceList.tasks = sourceList.tasks.filter((t) => t.id !== taskId);
      const targetTasks = sourceList === destList ? sourceList.tasks : destList.tasks;
      targetTasks.splice(destPosition, 0, task);

      try {
        await api.post(`/tasks/${taskId}/move`, { listId: destListId, position: destPosition });
        await this.refreshCurrent();
      } catch (err) {
        // refreshCurrent() passe par loadBoard(), qui remet `error` à null en
        // entrée : on la resynchronise d'abord, puis on affiche l'erreur.
        const message = err.message;
        await this.refreshCurrent();
        this.error = message;
      }
    },

    findTask(taskId) {
      for (const list of this.current?.lists ?? []) {
        const task = list.tasks.find((t) => t.id === taskId);
        if (task) return task;
      }
      return null;
    },

    patchTaskLocally(taskId, patch) {
      const task = this.findTask(taskId);
      if (task) Object.assign(task, patch);
    },

    async createTag(name, color) {
      const tag = await api.post(`/boards/${this.current.id}/tags`, { name, color });
      this.current.tags.push(tag);
      return tag;
    },

    async deleteTag(tagId) {
      await api.delete(`/tags/${tagId}`);
      this.current.tags = this.current.tags.filter((t) => t.id !== tagId);
      for (const list of this.current.lists) {
        for (const task of list.tasks) {
          task.tags = task.tags.filter((t) => t.id !== tagId);
        }
      }
    },

    async attachTag(taskId, tagId) {
      const tag = await api.post(`/tasks/${taskId}/tags`, { tagId });
      const task = this.findTask(taskId);
      if (task && !task.tags.some((t) => t.id === tag.id)) task.tags.push(tag);
    },

    async detachTag(taskId, tagId) {
      await api.delete(`/tasks/${taskId}/tags/${tagId}`);
      const task = this.findTask(taskId);
      if (task) task.tags = task.tags.filter((t) => t.id !== tagId);
    },

    async addSubtask(taskId, title) {
      const subtask = await api.post(`/tasks/${taskId}/subtasks`, { title });
      const task = this.findTask(taskId);
      if (task) task.subtasks.push(subtask);
    },

    async toggleSubtask(taskId, subtaskId, done) {
      const subtask = await api.patch(`/subtasks/${subtaskId}`, { done });
      const task = this.findTask(taskId);
      const local = task?.subtasks.find((s) => s.id === subtaskId);
      if (local) local.done = subtask.done;
    },

    async deleteSubtask(taskId, subtaskId) {
      await api.delete(`/subtasks/${subtaskId}`);
      const task = this.findTask(taskId);
      if (task) task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
    },
  },
});
