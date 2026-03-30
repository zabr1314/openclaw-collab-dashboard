// 多 Agent 协作框架 — 核心类型定义

export type AgentRole = "orchestrator" | "researcher" | "writer" | "reviewer" | "executor";

export type TaskStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export type StepStatus = "waiting" | "running" | "done" | "failed" | "skipped";

export type ExecutionMode = "sequential" | "parallel" | "dialogue";

/** 协作任务中单个 agent 的步骤 */
export interface CollabStep {
  stepId: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  role: AgentRole;
  prompt: string;           // 发给该 agent 的指令（可含 {{prev}} 占位符引用上一步输出）
  status: StepStatus;
  output?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

/** 一个协作任务 */
export interface CollabTask {
  taskId: string;
  title: string;
  goal: string;             // 用户输入的总目标
  mode: ExecutionMode;
  steps: CollabStep[];
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  finalOutput?: string;     // 汇总后的最终输出
  dialogueRounds?: number;  // 对话模式：轮次数（默认 3）
  dialogueHistory?: string[]; // 对话历史记录
}

/** SSE 推送的事件类型 */
export type CollabEventType =
  | "task_started"
  | "step_started"
  | "step_chunk"      // agent 流式输出片段
  | "step_done"
  | "step_failed"
  | "task_done"
  | "task_failed";

export interface CollabEvent {
  type: CollabEventType;
  taskId: string;
  stepId?: string;
  chunk?: string;
  output?: string;
  error?: string;
  finalOutput?: string;
  ts: number;
}

/** 创建协作任务的请求体 */
export interface CreateCollabTaskRequest {
  title: string;
  goal: string;
  mode: ExecutionMode;
  steps: Array<{
    agentId: string;
    role: AgentRole;
    prompt: string;
  }>;
  dialogueRounds?: number;
}
