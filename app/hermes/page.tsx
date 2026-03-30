"use client";

import { useState, useEffect } from "react";
import type { HermesTask } from "@/lib/hermes-types";

export default function HermesPage() {
  const [goal, setGoal] = useState("");
  const [topics, setTopics] = useState(["", ""]);
  const [tasks, setTasks] = useState<HermesTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
    const timer = setInterval(loadTasks, 3000);
    return () => clearInterval(timer);
  }, []);

  const loadTasks = () => {
    fetch("/api/hermes/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []));
  };

  const addTopic = () => setTopics([...topics, ""]);
  const removeTopic = (idx: number) => setTopics(topics.filter((_, i) => i !== idx));
  const updateTopic = (idx: number, value: string) => {
    const updated = [...topics];
    updated[idx] = value;
    setTopics(updated);
  };

  const createTask = async () => {
    if (!goal || topics.some((t) => !t)) {
      alert("请填写完整");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/hermes/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, topics }),
      });
      setGoal("");
      setTopics(["", ""]);
      loadTasks();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧠 Hermes - Orchestrator-Workers</h1>

      {/* 创建任务 */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="text-lg font-semibold mb-3">创建研究任务</h2>
        <textarea
          placeholder="研究目标（如：分析 2025 年 AI 智能体的技术趋势）"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] mb-3"
        />

        <div className="space-y-2 mb-3">
          <div className="text-sm font-medium">研究方向（Orchestrator 会动态派生 Workers）</div>
          {topics.map((topic, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                placeholder={`方向 ${idx + 1}（如：大模型演进、芯片算力）`}
                value={topic}
                onChange={(e) => updateTopic(idx, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              />
              {topics.length > 1 && (
                <button onClick={() => removeTopic(idx)} className="px-3 text-red-400">删除</button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={addTopic} className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--card)]">
            + 添加方向
          </button>
          <button
            onClick={createTask}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "创建中..." : "🚀 启动研究"}
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.taskId} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-medium">{task.goal}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  状态: {task.status} · {task.workers.length} Workers
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                task.status === "done" ? "bg-green-500/20 text-green-400" :
                task.status === "running" ? "bg-blue-500/20 text-blue-400" :
                task.status === "failed" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>
                {task.status}
              </span>
            </div>

            {task.workers.length > 0 && (
              <div className="space-y-2 mt-3">
                {task.workers.map((w) => (
                  <div key={w.workerId} className="p-2 rounded bg-[var(--bg)] text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{w.topic}</span>
                      <span className="text-xs text-[var(--text-muted)]">{w.status}</span>
                    </div>
                    {w.findings && <div className="text-xs text-[var(--text-muted)]">{w.findings.slice(0, 100)}...</div>}
                  </div>
                ))}
              </div>
            )}

            {task.finalReport && (
              <div className="mt-3 p-3 rounded-lg border border-[var(--accent)] bg-[var(--bg)]">
                <div className="text-sm font-semibold mb-2">最终报告</div>
                <div className="text-sm whitespace-pre-wrap">{task.finalReport}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
