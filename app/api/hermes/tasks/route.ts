// POST /api/hermes/tasks - 创建 Hermes 任务
// GET  /api/hermes/tasks - 列出任务

import { NextRequest, NextResponse } from "next/server";
import { createHermesTask, spawnWorkers, runAllWorkers, orchestratorSummarize } from "@/lib/hermes-engine";
import { listTasks } from "@/lib/hermes-store";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(req: NextRequest) {
  const { goal, topics } = await req.json();

  if (!goal || !Array.isArray(topics)) {
    return NextResponse.json({ error: "goal and topics required" }, { status: 400 });
  }

  // 1. Orchestrator 规划
  const task = await createHermesTask(goal);

  // 2. 异步执行
  (async () => {
    await spawnWorkers(task.taskId, topics);
    await runAllWorkers(task.taskId);
    await orchestratorSummarize(task.taskId);
  })().catch(console.error);

  return NextResponse.json({ taskId: task.taskId, task }, { status: 201 });
}
