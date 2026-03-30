// GET /api/collab/stream?taskId=xxx — SSE 实时推送任务执行状态

import { NextRequest } from "next/server";
import { subscribeTask } from "@/lib/collab-engine";
import { getTask } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return new Response("Missing taskId", { status: 400 });
  }

  const task = getTask(taskId);
  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribeTask(taskId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      // 发送初始状态
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", task })}\n\n`));

      // 客户端断开时清理
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
