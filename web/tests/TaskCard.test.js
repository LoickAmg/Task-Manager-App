import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TaskCard from "@/components/TaskCard.vue";

function makeTask(overrides = {}) {
  return {
    id: "t1",
    title: "Une tâche",
    priority: "medium",
    dueDate: null,
    tags: [],
    subtasks: [],
    ...overrides,
  };
}

describe("TaskCard", () => {
  it("affiche le titre de la tâche", () => {
    const wrapper = mount(TaskCard, { props: { task: makeTask({ title: "Écrire les tests" }) } });
    expect(wrapper.text()).toContain("Écrire les tests");
  });

  it("affiche les chips de tags avec leur couleur", () => {
    const wrapper = mount(TaskCard, {
      props: { task: makeTask({ tags: [{ id: "tag1", name: "Urgent", color: "#ff0000" }] }) },
    });
    const chip = wrapper.find(".tag-chip");
    expect(chip.text()).toBe("Urgent");
    expect(chip.attributes("style")).toContain("background");
  });

  it("affiche la progression des sous-tâches", () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: makeTask({
          subtasks: [
            { id: "s1", title: "A", done: true },
            { id: "s2", title: "B", done: false },
          ],
        }),
      },
    });
    expect(wrapper.text()).toContain("1/2");
  });

  it("n'affiche pas de progression sans sous-tâches", () => {
    const wrapper = mount(TaskCard, { props: { task: makeTask() } });
    expect(wrapper.find(".subtask-progress").exists()).toBe(false);
  });

  it("émet 'open' au clic sur la carte", async () => {
    const wrapper = mount(TaskCard, { props: { task: makeTask({ id: "t42" }) } });
    await wrapper.find(".task-card").trigger("click");
    expect(wrapper.emitted("open")).toEqual([["t42"]]);
  });

  it("applique la classe de priorité correspondante", () => {
    const wrapper = mount(TaskCard, { props: { task: makeTask({ priority: "high" }) } });
    expect(wrapper.find(".task-card").classes()).toContain("priority-high");
  });
});
