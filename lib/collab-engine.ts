// 协作任务执行引擎
// 通过 openclaw CLI 调用各 agent，支持串行/并行两种模式

import crypto from "crypto";
import { execOpenclaw } from "./openclaw-cli";
import { saveTask, getTask } from "./collab-store";
import type {
  CollabTask,
  CollabStep,
  CollabEvent,
  CreateCollabTaskRequest,
  AgentRole,
} from "./collab-types";

// SSE 订阅者 map: taskId -> Set of writer functions
const subscribers = new Map<string, Set<(event: CollabEvent) => void>>();

export function subscribeTask(taskId: string, cb: (event: CollabEvent) => void): () => void {
  if (!subscribers.has(taskId)) subscribers.set(taskId, new Set());
  subscribers.get(taskId)!.add(cb);
  return () => {
    subscribers.get(taskId)?.delete(cb);
    if (subscribers.get(taskId)?.size === 0) subscribers.delete(taskId);
  };
}

function emit(event: CollabEvent) {
  subscribers.get(event.taskId)?.forEach((cb) => cb(event));
}

function makeId() {
  return crypto.randomBytes(6).toString("hex");
}

export function createTask(req: CreateCollabTaskRequest, agentMeta: Record<string, { name: string; emoji: string }>): CollabTask {
  const taskId = makeId();
  const steps: CollabStep[] = req.steps.map((s) => ({
    stepId: makeId(),
    agentId: s.agentId,
    agentName: agentMeta[s.agentId]?.name ?? s.agentId,
    agentEmoji: agentMeta[s.agentId]?.emoji ?? "🤖",
    role: s.role,
    prompt: s.prompt,
    status: "waiting",
  }));

  const task: CollabTask = {
    taskId,
    title: req.title,
    goal: req.goal,
    mode: req.mode,
    steps,
    status: "pending",
    createdAt: Date.now(),
  };
  saveTask(task);
  return task;
}

async function runStep(task: CollabTask, step: CollabStep, prevOutput: string): Promise<string> {
  // 替换 {{prev}} 占位符
  const prompt = step.prompt.replace(/\{\{prev\}\}/g, prevOutput || "（无上一步输出）");

  step.status = "running";
  step.startedAt = Date.now();
  saveTask(task);
  emit({ type: "step_started", taskId: task.taskId, stepId: step.stepId, ts: Date.now() });

  try {
    const { stdout, stderr } = await execOpenclaw([
      "chat",
      "--agent", step.agentId,
      "--message", prompt,
      "--no-stream",
      "--json",
    ]);

    const raw = stdout.trim() || stderr.trim();
    let output = raw;

    // 尝试解析 JSON 格式的输出
    try {
      const parsed = JSON.parse(raw);
      output = parsed.reply ?? parsed.text ?? parsed.content ?? raw;
    } catch {}

    step.output = output;
    step.status = "done";
    step.finishedAt = Date.now();
    step.durationMs = step.finishedAt - (step.startedAt ?? step.finishedAt);
    saveTask(task);
    emit({ type: "step_done", taskId: task.taskId, stepId: step.stepId, output, ts: Date.now() });
    return output;
  } catch (err: any) {
    const error = err?.stderr?.trim() || err?.message || "Unknown error";
    step.status = "failed";
    step.error = error;
    step.finishedAt = Date.now();
    step.durationMs = (step.finishedAt - (step.startedAt ?? step.finishedAt));
    saveTask(task);
    emit({ type: "step_failed", taskId: task.taskId, stepId: step.stepId, error, ts: Date.now() });
    throw new Error(error);
  }
}

export async function runTask(taskId: string) {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  task.status = "running";
  task.startedAt = Date.now();
  saveTask(task);
  emit({ type: "task_started", taskId, ts: Date.now() });

  try {
    if (task.mode === "sequential") {
      let prevOutput = task.goal;
      for (const step of task.steps) {
        prevOutput = await runStep(task, step, prevOutput);
      }
      task.finalOutput = prevOutput;
    } else {
      // 并行模式：所有 step 同时执行，输入都是 goal
      const results = await Promise.allSettled(
        task.steps.map((step) => runStep(task, step, task.goal))
      );
      const outputs = results.map((r, i) =>
        r.status === "fulfilled"
          ? `[${task.steps[i].agentEmoji} ${task.steps[i].agentName}]\n${r.value}`
          : `[${task.steps[i].agentEmoji} ${task.steps[i].agentName}]\n❌ ${(r as PromiseRejectedResult).reason?.message}`
      );
      task.finalOutput = outputs.join("\n\n---\n\n");
    }

    task.status = "done";
    task.finishedAt = Date.now();
    saveTask(task);
    emit({ type: "task_done", taskId, finalOutput: task.finalOutput, ts: Date.now() });
  } catch (err: any) {
    task.status = "failed";
    task.finishedAt = Date.now();
    saveTask(task);
    emit({ type: "task_failed", taskId, error: err.message, ts: Date.now() });
  }
}
