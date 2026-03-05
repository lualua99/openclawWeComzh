import { html, nothing } from "lit";
import { icons } from "../icons.ts";
import { formatToolDetail, resolveToolDisplay } from "../tool-display.ts";
import type { ToolCard } from "../types/chat-types.ts";
import { TOOL_INLINE_THRESHOLD } from "./constants.ts";
import { extractTextCached } from "./message-extract.ts";
import { isToolResultMessage } from "./message-normalizer.ts";
import { formatToolOutputForSidebar, getTruncatedPreview } from "./tool-helpers.ts";

export function extractToolCards(message: unknown): ToolCard[] {
  const m = message as Record<string, unknown>;
  const content = normalizeContent(m.content);
  const cards: ToolCard[] = [];

  for (const item of content) {
    const kind = (typeof item.type === "string" ? item.type : "").toLowerCase();
    const isToolCall =
      ["toolcall", "tool_call", "tooluse", "tool_use"].includes(kind) ||
      (typeof item.name === "string" && item.arguments != null);
    if (isToolCall) {
      cards.push({
        kind: "call",
        name: (item.name as string) ?? "tool",
        args: coerceArgs(item.arguments ?? item.args),
      });
    }
  }

  for (const item of content) {
    const kind = (typeof item.type === "string" ? item.type : "").toLowerCase();
    if (kind !== "toolresult" && kind !== "tool_result") {
      continue;
    }
    const text = extractToolText(item);
    const name = typeof item.name === "string" ? item.name : "tool";
    cards.push({ kind: "result", name, text });
  }

  if (isToolResultMessage(message) && !cards.some((card) => card.kind === "result")) {
    const name =
      (typeof m.toolName === "string" && m.toolName) ||
      (typeof m.tool_name === "string" && m.tool_name) ||
      "tool";
    const text = extractTextCached(message) ?? undefined;
    cards.push({ kind: "result", name, text });
  }

  return cards;
}

// ─── Task Planner Card ────────────────────────────────────────────────────────
function renderTodosCard(card: ToolCard) {
  const args = (card.args || {}) as Record<string, unknown>;
  const action = args.action || "unknown";

  // --- Call: create_plan
  if (card.kind === "call" && action === "create_plan") {
    return html`
      <div class="chat-tool-card chat-tool-card--plan-create">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-tool-card__plan-icon">📋</span>
            <span>Creating Task Plan</span>
          </div>
          <span class="chat-plan-badge chat-plan-badge--new">NEW</span>
        </div>
        ${args.description ? html`<div class="chat-plan-desc">${args.description}</div>` : nothing}
      </div>
    `;
  }

  // --- Call: add_todo
  if (card.kind === "call" && action === "add_todo") {
    return html`
      <div class="chat-tool-card chat-tool-card--plan-add">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-tool-card__plan-icon">➕</span>
            <span>Adding Task</span>
          </div>
        </div>
        ${
          args.title
            ? html`<div class="chat-plan-todo-item chat-plan-todo-item--pending">
              <span class="chat-plan-todo-icon">⏳</span>
              <span>${args.title}</span>
            </div>`
            : nothing
        }
      </div>
    `;
  }

  // --- Call: update_todo
  if (card.kind === "call" && action === "update_todo") {
    const isDone = args.status === "done";
    const isActive = args.status === "in_progress";
    return html`
      <div class="chat-tool-card chat-tool-card--plan-update">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-tool-card__plan-icon">${isDone ? "✅" : isActive ? "🔄" : "📝"}</span>
            <span>${isDone ? "Task Completed" : isActive ? "Task In Progress" : "Updating Task"}</span>
          </div>
          ${
            isDone
              ? html`
                  <span class="chat-plan-badge chat-plan-badge--done">DONE</span>
                `
              : isActive
                ? html`
                    <span class="chat-plan-badge chat-plan-badge--active">ACTIVE</span>
                  `
                : nothing
          }
        </div>
        ${
          args.title || args.taskId
            ? html`<div class="chat-plan-todo-item ${isDone ? "chat-plan-todo-item--done" : isActive ? "chat-plan-todo-item--active" : "chat-plan-todo-item--pending"}">
              <span class="chat-plan-todo-icon">${isDone ? "✅" : isActive ? "🔄" : "⏳"}</span>
              <span>${args.title || `Task #${String(args.taskId)}`}</span>
            </div>`
            : nothing
        }
      </div>
    `;
  }

  // --- Call: read_plan / complete_plan
  if (card.kind === "call" && (action === "read_plan" || action === "complete_plan")) {
    return html`
      <div class="chat-tool-card chat-tool-card--plan-read">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-tool-card__plan-icon">${action === "complete_plan" ? "🎉" : "📊"}</span>
            <span>${action === "complete_plan" ? "Completing All Tasks" : "Reviewing Task Plan"}</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- Result: plan state
  if (card.kind === "result" && card.text) {
    try {
      const res = JSON.parse(card.text) as {
        plan?: {
          description?: string;
          todos?: Array<{ id: string; title: string; status: string }>;
        };
        digest?: string;
      };
      const plan = res.plan;
      if (plan && Array.isArray(plan.todos)) {
        const done = plan.todos.filter((t) => t.status === "done").length;
        const total = plan.todos.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const allDone = done === total;
        return html`
          <div class="chat-tool-card chat-tool-card--plan-result ${allDone ? "chat-tool-card--plan-complete" : ""}">
            <div class="chat-tool-card__header">
              <div class="chat-tool-card__title">
                <span class="chat-tool-card__plan-icon">${allDone ? "🎉" : "📋"}</span>
                <span>${allDone ? "All Tasks Complete!" : "Task Plan"}</span>
              </div>
              <span class="chat-plan-progress-label">${done}/${total}</span>
            </div>
            ${
              plan.description
                ? html`<div class="chat-plan-desc">${plan.description}</div>`
                : nothing
            }
            <div class="chat-plan-progress-bar">
              <div
                class="chat-plan-progress-fill ${allDone ? "chat-plan-progress-fill--complete" : ""}"
                style="width: ${pct}%"
              ></div>
            </div>
            <div class="chat-plan-todo-list">
              ${plan.todos.map(
                (t) => html`
                  <div class="chat-plan-todo-item ${t.status === "done" ? "chat-plan-todo-item--done" : t.status === "in_progress" ? "chat-plan-todo-item--active" : "chat-plan-todo-item--pending"}">
                    <span class="chat-plan-todo-icon">
                      ${t.status === "done" ? "✅" : t.status === "in_progress" ? "🔄" : "⏳"}
                    </span>
                    <span>${t.title}</span>
                  </div>
                `,
              )}
            </div>
          </div>
        `;
      }
    } catch {
      // fall through
    }
  }

  return nothing;
}

// ─── Subagent Delegation Card ─────────────────────────────────────────────────
function renderSpawnCard(card: ToolCard) {
  if (card.kind === "call") {
    const args = (card.args || {}) as Record<string, unknown>;
    const associatedTaskId = args.associatedTaskId as string | undefined;
    const label = (args.label as string | undefined)?.trim();
    const task = (args.task as string | undefined) ?? "Delegating task...";
    const model = args.model as string | undefined;
    const taskPreview = task.length > 120 ? `${task.slice(0, 118)}…` : task;
    return html`
      <div class="chat-tool-card chat-spawn-card">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-spawn-lobster">🦞</span>
            <span>Delegating to Subagent</span>
          </div>
          <span class="chat-spawn-pulse"></span>
        </div>
        <div class="chat-spawn-body">
          ${label ? html`<div class="chat-spawn-label">${label}</div>` : nothing}
          ${model ? html`<div class="chat-spawn-meta">Model: <code>${model}</code></div>` : nothing}
          ${
            associatedTaskId
              ? html`<div class="chat-spawn-meta">
                Task: <code class="chat-spawn-task-id">${associatedTaskId}</code>
                <span class="chat-spawn-link-badge">↗ Linked</span>
              </div>`
              : nothing
          }
          <div class="chat-spawn-task-preview">${taskPreview}</div>
        </div>
      </div>
    `;
  }

  // Result: subagent completed
  if (card.kind === "result" && card.text) {
    const isOk =
      card.text.includes('"status":"ok"') ||
      card.text.toLowerCase().includes("completed") ||
      card.text.toLowerCase().includes("done");
    return html`
      <div class="chat-tool-card chat-spawn-card chat-spawn-card--result">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-spawn-lobster">${isOk ? "✅" : "🦞"}</span>
            <span>Subagent ${isOk ? "Completed" : "Result"}</span>
          </div>
          ${
            isOk
              ? html`
                  <span class="chat-plan-badge chat-plan-badge--done">DONE</span>
                `
              : nothing
          }
        </div>
        <div class="chat-spawn-result-preview">${card.text.slice(0, 200)}${card.text.length > 200 ? "…" : ""}</div>
      </div>
    `;
  }

  return nothing;
}

export function renderToolCardSidebar(card: ToolCard, onOpenSidebar?: (content: string) => void) {
  const display = resolveToolDisplay({ name: card.name, args: card.args });
  const detail = formatToolDetail(display);
  const hasText = Boolean(card.text?.trim());

  const canClick = Boolean(onOpenSidebar);
  const handleClick = canClick
    ? () => {
        if (hasText) {
          onOpenSidebar(formatToolOutputForSidebar(card.text));
          return;
        }
        const info = `## ${display.label}\n\n${
          detail ? `**Command:** \`${detail}\`\n\n` : ""
        }*No output — tool completed successfully.*`;
        onOpenSidebar(info);
      }
    : undefined;

  const isShort = hasText && (card.text?.length ?? 0) <= TOOL_INLINE_THRESHOLD;
  const showCollapsed = hasText && !isShort;
  const showInline = hasText && isShort;
  const isEmpty = !hasText;

  // ── Custom: Task Planner
  if (card.name === "write_todos") {
    const custom = renderTodosCard(card);
    if (custom !== nothing) {
      return custom;
    }
  }

  // ── Custom: Subagent Spawn
  if (card.name === "sessions_spawn") {
    const custom = renderSpawnCard(card);
    if (custom !== nothing) {
      return custom;
    }
  }

  return html`
    <div
      class="chat-tool-card ${canClick ? "chat-tool-card--clickable" : ""}"
      @click=${handleClick}
      role=${canClick ? "button" : nothing}
      tabindex=${canClick ? "0" : nothing}
      @keydown=${
        canClick
          ? (e: KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") {
                return;
              }
              e.preventDefault();
              handleClick?.();
            }
          : nothing
      }
    >
      <div class="chat-tool-card__header">
        <div class="chat-tool-card__title">
          <span class="chat-tool-card__icon">${icons[display.icon]}</span>
          <span>${display.label}</span>
        </div>
        ${
          canClick
            ? html`<span class="chat-tool-card__action">${hasText ? "View" : ""} ${icons.check}</span>`
            : nothing
        }
        ${isEmpty && !canClick ? html`<span class="chat-tool-card__status">${icons.check}</span>` : nothing}
      </div>
      ${detail ? html`<div class="chat-tool-card__detail">${detail}</div>` : nothing}
      ${
        isEmpty
          ? html`
              <div class="chat-tool-card__status-text muted">Completed</div>
            `
          : nothing
      }
      ${
        showCollapsed
          ? html`<div class="chat-tool-card__preview mono">${getTruncatedPreview(card.text)}</div>`
          : nothing
      }
      ${showInline ? html`<div class="chat-tool-card__inline mono">${card.text}</div>` : nothing}
    </div>
  `;
}

function normalizeContent(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter(Boolean) as Array<Record<string, unknown>>;
}

function coerceArgs(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractToolText(item: Record<string, unknown>): string | undefined {
  if (typeof item.text === "string") {
    return item.text;
  }
  if (typeof item.content === "string") {
    return item.content;
  }
  return undefined;
}
