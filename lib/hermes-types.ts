// Hermes 架构 - 核心类型定义
// 基于 Anthropic 的 Orchestrator-Workers 模式

/** Worker 状态 */
export type WorkerStatus = "idle" | "thinking" | "acting" | "done" | "failed";

/** 任务状态 */
export type TaskStatus = "planning" | "running" | "done" | "failed";

/** Worker 动作类型（ReAct 模式）*/
export type WorkerAction = "search" | "think" | "report";

/** 单个 Worker（动态派生）*/
export interface Worker {
  workerId: string;
  topic: string;           // 专注领域（如 "AI算法"、"硬件趋势"）
  status: WorkerStatus;
  context: string[];       // 独立上下文（隔离）
  findings: string;        // 压缩后的发现
  error?: string;
  createdAt: number;
  finishedAt?: number;
}

/** Memory 模块 - 防止遗忘 */
export interface TaskMemory {
  goal: string;            // 初始目标
  plan: string;            // Orchestrator 的规划
  savedAt: number;
}

/** 检查点 - 断点续传 */
export interface Checkpoint {
  taskId: string;
  status: TaskStatus;
  memory: TaskMemory;
  workers: Worker[];
  createdAt: number;
}

/** Hermes 任务 */
export interface HermesTask {
  taskId: string;
  goal: string;
  status: TaskStatus;
  memory: TaskMemory;      // 外部记忆
  workers: Worker[];       // 动态派生的 Workers
  finalReport?: string;
  createdAt: number;
  finishedAt?: number;
}
