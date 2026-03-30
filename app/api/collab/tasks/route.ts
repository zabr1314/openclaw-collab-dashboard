// POST /api/collab/tasks — 创建并启动协作任务
// GET  /api/collab/tasks — 列出所有任务

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";
import { createTask, runTask } from "@/lib/collab-engine";
import { listTasks } from "@/lib/collab-store";
import type { CreateCollabTaskRequest } from "@/lib/collab-types";

function loadAgentMeta(): Record<string, { name: string; emoji: string }> {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const list: any[] = config.agents?.list || [];
    const meta: Record<string, { name: string; emoji: string }> = {};
    for (const a of list) {
      meta[a.id] = { name: a.name || a.id, emoji: a.identity?.emoji || "🤖" };
    }
    return meta;
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(req: NextRequest) {
  let body: CreateCollabTaskRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.goal || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "goal and steps are required" }, { status: 400 });
  }

  const agentMeta = loadAgentMeta();
  const task = createTask(body, agentMeta);

  // 异步执行，不阻塞响应
  runTask(task.taskId).catch(() => {});

  return NextResponse.json({ taskId: task.taskId, task }, { status: 201 });
}
