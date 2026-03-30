// Hermes 执行引擎 - Orchestrator-Workers 架构
import crypto from "crypto";
import { execOpenclaw } from "./openclaw-cli";
import { saveTask, getTask, saveCheckpoint, getCheckpoint } from "./hermes-store";
import type { HermesTask, Worker, TaskMemory, Checkpoint } from "./hermes-types";

function makeId() {
  return crypto.randomBytes(6).toString("hex");
}

// ============ Orchestrator 规划阶段 ============

export async function createHermesTask(goal: string): Promise<HermesTask> {
  const taskId = makeId();

  // 1. Orchestrator 规划
  const plan = await orchestratorPlan(goal);

  // 2. 保存到 Memory（防止遗忘）
  const memory: TaskMemory = {
    goal,
    plan,
    savedAt: Date.now(),
  };

  const task: HermesTask = {
    taskId,
    goal,
    status: "planning",
    memory,
    workers: [],
    createdAt: Date.now(),
  };

  saveTask(task);
  saveCheckpoint({ taskId, status: "planning", memory, workers: [], createdAt: Date.now() });

  return task;
}

async function orchestratorPlan(goal: string): Promise<string> {
  const prompt = `你是一个研究任务的协调者（Orchestrator）。

用户目标：${goal}

请分析这个目标，规划需要哪些研究方向。输出格式：
1. 方向A：简短描述
2. 方向B：简短描述
...

只输出规划，不要执行。`;

  const { stdout } = await execOpenclaw(["chat", "--message", prompt, "--no-stream"]);
  return stdout.trim();
}

// ============ 动态派生 Workers ============

export async function spawnWorkers(taskId: string, topics: string[]): Promise<void> {
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");

  task.status = "running";

  // 动态创建 Workers
  for (const topic of topics) {
    const worker: Worker = {
      workerId: makeId(),
      topic,
      status: "idle",
      context: [],
      findings: "",
      createdAt: Date.now(),
    };
    task.workers.push(worker);
  }

  saveTask(task);
  saveCheckpoint({ taskId, status: "running", memory: task.memory, workers: task.workers, createdAt: Date.now() });
}

// ============ Worker ReAct 循环（交错思考）============

async function runWorker(task: HermesTask, worker: Worker): Promise<void> {
  worker.status = "thinking";
  saveTask(task);

  const prompt = `你是一个专注于【${worker.topic}】的研究助手。

总体目标：${task.memory.goal}
你的任务：深入研究 ${worker.topic}

请进行 2-3 轮的 思考→搜索→思考 循环，最后输出核心发现（200字以内）。`;

  try {
    const { stdout, stderr } = await execOpenclaw(["chat", "--message", prompt, "--no-stream"]);

    // AI 自愈：如果有错误，不抛异常，而是记录并让 Orchestrator 决定
    if (stderr) {
      worker.context.push(`[工具错误] ${stderr}`);
    }

    worker.findings = stdout.trim();
    worker.status = "done";
    worker.finishedAt = Date.now();
  } catch (err: any) {
    worker.error = err.message;
    worker.status = "failed";
    worker.finishedAt = Date.now();
  }

  saveTask(task);
  saveCheckpoint({ taskId: task.taskId, status: task.status, memory: task.memory, workers: task.workers, createdAt: Date.now() });
}

// ============ 并行执行所有 Workers ============

export async function runAllWorkers(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");

  // 并行执行（上下文隔离）
  await Promise.allSettled(
    task.workers.map((worker) => runWorker(task, worker))
  );

  saveTask(task);
}

// ============ Orchestrator 汇总 ============

export async function orchestratorSummarize(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");

  // 从 Memory 读取初始目标（防止遗忘）
  const { goal, plan } = task.memory;

  const findings = task.workers
    .filter((w) => w.status === "done")
    .map((w) => `【${w.topic}】\n${w.findings}`)
    .join("\n\n");

  const prompt = `你是研究协调者。

初始目标：${goal}
规划：${plan}

各 Worker 的发现：
${findings}

请汇总成一份完整报告（500字以内）。`;

  try {
    const { stdout } = await execOpenclaw(["chat", "--message", prompt, "--no-stream"]);
    task.finalReport = stdout.trim();
    task.status = "done";
  } catch (err: any) {
    task.status = "failed";
  }

  task.finishedAt = Date.now();
  saveTask(task);
}

// ============ 断点续传 ============

export async function resumeFromCheckpoint(taskId: string): Promise<void> {
  const checkpoint = getCheckpoint(taskId);
  if (!checkpoint) throw new Error("No checkpoint found");

  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");

  // 恢复状态
  task.status = checkpoint.status;
  task.memory = checkpoint.memory;
  task.workers = checkpoint.workers;

  // 继续执行未完成的 Workers
  const unfinishedWorkers = task.workers.filter((w) => w.status !== "done" && w.status !== "failed");

  if (unfinishedWorkers.length > 0) {
    await Promise.allSettled(
      unfinishedWorkers.map((worker) => runWorker(task, worker))
    );
  }

  // 汇总
  await orchestratorSummarize(taskId);
}


