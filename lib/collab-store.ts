// 协作任务内存存储（进程内，重启清空）
// 生产环境可替换为 Redis / SQLite

import type { CollabTask } from "./collab-types";

const store = new Map<string, CollabTask>();

export function saveTask(task: CollabTask) {
  store.set(task.taskId, task);
}

export function getTask(taskId: string): CollabTask | undefined {
  return store.get(taskId);
}

export function listTasks(): CollabTask[] {
  return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteTask(taskId: string) {
  store.delete(taskId);
}
