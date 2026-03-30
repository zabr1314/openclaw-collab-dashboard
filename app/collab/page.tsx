"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import type { CollabTask, CollabStep, AgentRole, ExecutionMode } from "@/lib/collab-types";

interface Agent {
  id: string;
  name: string;
  emoji: string;
}

export default function CollabPage() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<CollabTask[]>([]);
  const [activeTask, setActiveTask] = useState<CollabTask | null>(null);
  const [loading, setLoading] = useState(false);

  // 表单状态
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<ExecutionMode>("sequential");
  const [steps, setSteps] = useState<Array<{ agentId: string; role: AgentRole; prompt: string }>>([
    { agentId: "", role: "researcher", prompt: "" },
  ]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.agents)) {
          setAgents(data.agents.map((a: any) => ({ id: a.id, name: a.name, emoji: a.emoji })));
        }
      });
    loadTasks();
  }, []);

  const loadTasks = () => {
    fetch("/api/collab/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []));
  };

  const addStep = () => {
    setSteps([...steps, { agentId: "", role: "executor", prompt: "" }]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof typeof steps[0], value: any) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const createTask = async () => {
    if (!title || !goal || steps.some((s) => !s.agentId || !s.prompt)) {
      alert("请填写完整信息");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/collab/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goal, mode, steps }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveTask(data.task);
        loadTasks();
        // 清空表单
        setTitle("");
        setGoal("");
        setSteps([{ agentId: "", role: "researcher", prompt: "" }]);
      } else {
        alert(data.error || "创建失败");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🤝 多 Agent 协作</h1>

      {/* 创建任务表单 */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="text-lg font-semibold mb-3">创建协作任务</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="任务标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          />
          <textarea
            placeholder="总体目标（会传递给第一个 agent）"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          />
          <div className="flex gap-2">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "sequential"} onChange={() => setMode("sequential")} />
              <span className="text-sm">串行（上一步输出传给下一步）</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "parallel"} onChange={() => setMode("parallel")} />
              <span className="text-sm">并行（所有 agent 同时执行）</span>
            </label>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">步骤 {idx + 1}</span>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(idx)} className="text-red-400 text-sm">删除</button>
                )}
              </div>
              <select
                value={step.agentId}
                onChange={(e) => updateStep(idx, "agentId", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              >
                <option value="">选择 Agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                ))}
              </select>
              <select
                value={step.role}
                onChange={(e) => updateStep(idx, "role", e.target.value as AgentRole)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              >
                <option value="orchestrator">主控</option>
                <option value="researcher">调研</option>
                <option value="writer">撰写</option>
                <option value="reviewer">审核</option>
                <option value="executor">执行</option>
              </select>
              <textarea
                placeholder="指令（串行模式可用 {{prev}} 引用上一步输出）"
                value={step.prompt}
                onChange={(e) => updateStep(idx, "prompt", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={addStep} className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--card)]">
              + 添加步骤
            </button>
            <button
              onClick={createTask}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "创建中..." : "🚀 启动协作"}
            </button>
          </div>
        </div>
      </div>

      {/* 活动任务实时监控 */}
      {activeTask && <TaskMonitor task={activeTask} onClose={() => setActiveTask(null)} />}

      {/* 任务历史列表 */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="text-lg font-semibold mb-3">任务历史</h2>
        {tasks.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">暂无任务</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.taskId} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {task.steps.length} 步骤 · {task.mode === "sequential" ? "串行" : "并行"} · {task.status}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTask(task)}
                  className="px-3 py-1 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--card)]"
                >
                  查看
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskMonitor({ task, onClose }: { task: CollabTask; onClose: () => void }) {
  const [liveTask, setLiveTask] = useState(task);

  useEffect(() => {
    const es = new EventSource(`/api/collab/stream?taskId=${task.taskId}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "init") {
        setLiveTask(event.task);
      } else if (event.type === "step_started" || event.type === "step_done" || event.type === "step_failed") {
        setLiveTask((prev) => {
          const updated = { ...prev };
          const step = updated.steps.find((s) => s.stepId === event.stepId);
          if (step) {
            if (event.type === "step_started") step.status = "running";
            if (event.type === "step_done") {
              step.status = "done";
              step.output = event.output;
            }
            if (event.type === "step_failed") {
              step.status = "failed";
              step.error = event.error;
            }
          }
          return updated;
        });
      } else if (event.type === "task_done" || event.type === "task_failed") {
        setLiveTask((prev) => ({
          ...prev,
          status: event.type === "task_done" ? "done" : "failed",
          finalOutput: event.finalOutput,
        }));
      }
    };
    return () => es.close();
  }, [task.taskId]);

  return (
    <div className="mb-6 p-4 rounded-xl border-2 border-[var(--accent)] bg-[var(--card)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{liveTask.title}</h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
      </div>
      <div className="space-y-2">
        {liveTask.steps.map((step) => (
          <div key={step.stepId} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{step.agentEmoji}</span>
              <span className="font-medium">{step.agentName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)]">{step.role}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                step.status === "done" ? "bg-green-500/20 text-green-400" :
                step.status === "running" ? "bg-blue-500/20 text-blue-400" :
                step.status === "failed" ? "bg-red-500/20 text-red-400" :
                "bg-[var(--border)] text-[var(--text-muted)]"
              }`}>
                {step.status}
              </span>
            </div>
            {step.output && (
              <div className="text-sm text-[var(--text)] whitespace-pre-wrap bg-[var(--card)] p-2 rounded border border-[var(--border)]">
                {step.output}
              </div>
            )}
            {step.error && <div className="text-sm text-red-400">{step.error}</div>}
          </div>
        ))}
      </div>
      {liveTask.finalOutput && (
        <div className="mt-4 p-3 rounded-lg border-2 border-[var(--accent)] bg-[var(--bg)]">
          <div className="text-sm font-semibold mb-2">最终输出</div>
          <div className="text-sm whitespace-pre-wrap">{liveTask.finalOutput}</div>
        </div>
      )}
    </div>
  );
}
