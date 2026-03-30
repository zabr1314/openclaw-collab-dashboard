// Memory & Checkpoint 存储
// 防止遗忘 + 断点续传

import type { HermesTask, Checkpoint } from "./hermes-types";

const tasks = new Map<string, HermesTask>();
const checkpoints = new Map<string, Checkpoint>();

export function saveTask(task: HermesTask) {
  tasks.set(task.taskId, task);
}

export function getTask(taskId: string): HermesTask | undefined {
  return tasks.get(taskId);
}

export function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoints.set(checkpoint.taskId, checkpoint);
}

export function getCheckpoint(taskId: string): Checkpoint | undefined {
  return checkpoints.get(taskId);
}

export function listTasks(): HermesTask[] {
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
}
