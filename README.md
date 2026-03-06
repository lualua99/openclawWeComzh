# 🦞 openclawWeComzh — Personal AI Assistant

> **为国内生态倾力打造的 OpenClaw 深度中文化版本。**
> 这是一个让你可以在本地私有化运行、掌控全局的私人 AI 智能体工作流引擎。
>
> 📦 **开源仓库主页**: [https://github.com/luolin-ai/openclawWeComzh](https://github.com/luolin-ai/openclawWeComzh)

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text.png" alt="openclawWeComzh" width="400">
    </picture>
</p>

<p align="center">
  <a href="https://github.com/luolin-ai/openclawWeComzh/actions"><img src="https://img.shields.io/github/actions/workflow/status/luolin-ai/openclawWeComzh/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/luolin-ai/openclawWeComzh/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2022-green.svg?style=for-the-badge" alt="Node Version Requirement"></a>
</p>

## 核心突破：赋予多智能体系统真正的“元认知”自我进化能力与“发散修正”能力\*\*

在处理极其复杂的长时间维度任务时，传统的自主 Agent 往往容易陷入动作“死循环”——例如为了解决一个 Bug 不断地重复编辑和报错。本项目针对性地引入了基于复利折叠（Z ⇌ Z² + C）的监控环流：

- **`chaosScore` 混沌度量器**：底层的订阅分发中心（`pi-embedded-subscribe`）会实时监视动作指纹（Fingerprint）。当检测到 Agent 在原地打转或频繁报错时，会自动增加系统混沌值。
- **分形反思机制（Fractal Reflection）**：当混沌值越过安全阈值时，自动触发系统级侧入式钩子（Hooks）。强制打断当前发散的执行死循环（Divergence），并向主脑注入强力的人工提示，要求其调整方向或降维打击——例如指派具有特定上下文的子智能体（Subagent）去重新梳理问题，而不是一根筋死磕。

## 🚀 最新特性与更新 (Recent Updates)

> _注：大部分高阶架构原理解析可参考上游官方英文文档：[Docs](https://docs.openclaw.ai) / [DeepWiki](https://deepwiki.com/openclaw/openclaw)_

🎉 **v2025.3.x 核心里程碑 (重磅发布)**
_[当前项目仓库：luolin-ai/openclawWeComzh](https://github.com/luolin-ai/openclawWeComzh)_

- 🦞 **Sandbox 自动化工作流编排**：从传统的“被动问答对话框”进化为“主动派单工作台”。只需下发宏大目标，AI 即可拆解目标并生成 `task.md` 规划清单，每执行一步都会自我打卡标记状态。全面引入对高危终端命令的弹窗拦截审核机制（Human-in-the-loop）。
- 🧠 **本地私有知识库引擎挂载**：在多轮跨会话之间建立长线上下文记忆。直接让 AI 挂载本地项目文档和代码规范库，在遇到技术卡点时自主翻阅资料寻找突破。
- 🤖 **子代理会话记忆穿透**：支持主代理向子代理传递结构化上下文，子任务完成后自动回传更新状态，实现多层代理间记忆共享闭环。
- 🌍 **浏览器自动化持久化升级**：浏览器 Profile 与 Agent Session 自动绑定，跨次运行保留登录态（Cookie/localStorage）。
- ⚡️ **Batch 快照效率提升**：批量浏览器操作完成后自动暴露最终页面快照，减少 AI 解析中间过程的开销。
- 💻 **UI 浏览器工具可视化**：聊天界面浏览器工具卡支持内联前端截图渲染与快照摘要展示，过程完全可视。
- ♾️ **Z ⇌ Z² + C 认知环流深度融合**：赋予多智能体系统真正的“元认知”与“发散修正”能力。底层实时监视执行死循环，当混沌值（`chaosScore`）越过阈值时触发侧入式拦截，强制要求 AI 降维拆解或指派专职子代理，避免原地打结。
- 🎨 **Canvas A2UI 智能体交互画布**：告别纯文本，直接在侧边栏生成高交互性的前端组件、表单与图表。重构了底层的 Canvas 编译链，集成了下一代 Rust 打包器 `rolldown`，支持毫秒级页面热重载与极速组件通信。

---

🎉 **v2025.2.x 历史核心里程碑**

- 🧠 **Qwen / DeepSeek 流式深度整合**：
  - **思考过程全解析**：彻底修复了 Qwen-Web 和 DeepSeek 模型在输出深度推理标签 (`[(deep_think)]` / `<think>`) 时的截断或溢出问题。流式输出期间，UI 界面将优雅且平滑地展开“深度思考中 (Deep Thinking...)”折叠面板，展现 AI 推理全貌。
  - **本地工具强制关联机制**：修复了长时间多轮对话后，模型容易遗忘内部 XML 工具调用格式的问题。通过在上下文链路中注入隐式约束，确保模型能够随心所欲且稳定地唤起你的独立浏览器 (`openclaw` Profile) 或执行高危指令 (Bash commands)。
- 🇨🇳 **CLI 界面深度中文化**：
  - 我们对原生极具赛博朋克风格的终端向导工具 (`openclaw onboard`) 进行了逐字逐句的翻译和润色。
  - 涵盖所有配置流程：包括网关鉴权、模型选择、外部通讯渠道（Channels）接入和扩展技能（Skills）安装。保留了原汁原味的 Lobster 专属渐变色彩引擎。

## 📦 快速安装与启动 (Quick Start)

### Sponsors

| OpenAI                                                            | Blacksmith                                                                   | Convex                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [![OpenAI](docs/assets/sponsors/openai.svg)](https://openai.com/) | [![Blacksmith](docs/assets/sponsors/blacksmith.svg)](https://blacksmith.sh/) | [![Convex](docs/assets/sponsors/convex.svg)](https://www.convex.dev/) |

**Subscriptions (OAuth):**

- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

### 1. ⚡ 一键极速安装 (推荐)

如果你只是想快速体验或部署系统，可以直接在终端执行以下一键安装指令。该脚本会自动为您检测环境、配置依赖并启动向导：

```bash
curl -fsSL https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/install.sh | bash
```

**🌐 各系统环境安装说明：**

- **🍎 macOS**: 原生支持。脚本会自动检查系统依赖并引导是否安装 `cmake/brew` 等底层编译工具（用于本地大模型加速计算等扩展模块）。
- **🐧 Linux**: 广泛兼容各大主流发行版 (Ubuntu/Debian, CentOS/RHEL, Arch, Alpine等)。自动判断并提权安装例如 `build-essential` 等 C++ 编译环境。
- **🪟 Windows**: 提供原生的 PowerShell 一键安装支持！请确保以**管理员身份**打开 PowerShell 并执行以下指令：
  ```powershell
  iwr -useb https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/install.ps1 | iex
  ```
  _(注: 仍强烈推荐硬核极客在 WSL2 子系统下通过 bash 脚本体验最完整的本地化能力)_

---

### 2. 🛠️ 本地源码开发 (Development)

如果你希望进行二次定制架构开发，可以通过以下步骤运行：

**环境准备：** 确保已安装 [Node.js](https://nodejs.org/) (**≥ 22.0.0**) 和包管理器 `pnpm` (`npm i -g pnpm`)。

```bash
# 获取源码
git clone https://github.com/luolin-ai/openclawWeComzh.git
cd openclawWeComzh

# 安装项目依赖
pnpm install

# 编译项目 (首次运行将自动构建 UI 前端工程)
pnpm build

# 启动全中文沉浸式配置向导，注册基础设置并安装后台守护进程
pnpm openclaw onboard --install-daemon

# 以开发者模式启动网关（支持 TypeScript 热更新）
pnpm gateway:watch
```

### 3. 💻 终端与 Web UI 使用教程 (Usage Tutorial)

完成安装后，您可以通过以下方式启动系统：

1. **终端随叫随到**：直接在终端输入 `openclaw` 即可在命令行中与 AI 进行沉浸式交互。
2. **唤起图形控制台**：运行 `openclaw dashboard`，系统将自动在默认浏览器 (`http://127.0.0.1:18789`) 打开控制台。
3. **核心功能模块**：
   - **聊天 (Chat)**：下发指令、问答交互，支持 `/new` 快速重置会话。
   - **沙盘 (Sandbox)**：监控 AI 的后台执行链与多智能体派发情况。
   - **配置 (Config)**：中文化的全局系统参数设置面板。

## 📊 与上游官方版本对比 (Fork vs Upstream Comparison)

> **本 fork 基于 [openclaw/openclaw](https://github.com/openclaw/openclaw) 官方开源项目，在完全继承其所有高阶能力的基础上，针对国内生态进行了深度本土化定制。**

### 🔍 功能对比总览

| 功能维度          | 🌍 官方上游 openclaw/openclaw                            | 🇨🇳 本 Fork luolin-ai/openclawWeComzh                             |
| :---------------- | :------------------------------------------------------- | :--------------------------------------------------------------- |
| **界面语言**      | 全英文界面                                               | 全链路中文化，从终端到 Web UI                                    |
| **首选模型**      | Claude Opus / GPT-4 为主                                 | 深度适配 Qwen、DeepSeek、Kimi K2.5 等国内顶级模型                |
| **模型接入方式**  | 官方 API 为主（Anthropic、OpenAI、OpenRouter）           | 额外支持 Moonshot、通义千问等国内 OpenAI 兼容 API                |
| **深度思考渲染**  | 基础展示                                                 | 修复 `[(deep_think)]` / `<think>` 标签解析，完整流式呈现推理过程 |
| **通信渠道**      | WhatsApp、Telegram、Discord、Slack、iMessage 等 20+ 渠道 | 继承全部，同时重点研发企业微信、微信等国内渠道（研发中）         |
| **Telegram 支持** | ✅ 完整支持                                              | ✅ 深度适配 + 多 Bot 账号管理                                    |
| **多智能体编排**  | ✅ Agent-to-Agent（sessions_send）                       | ✅ 继承全部 + Kimi 副脑双 Agent 配置示例开箱即用                 |
| **Sandbox 沙盒**  | ✅ Docker 隔离 + 工具限制                                | ✅ 继承 + Human-in-the-loop 高危拦截，中文任务面板               |
| **知识库能力**    | Memory QMD（向量检索）                                   | ✅ 继承 + 本地文档目录挂载的使用教程与示例                       |
| **Web 控制台**    | 英文全功能 Web UI                                        | 中文化全功能 Web UI（Chat / Sandbox / Agents / Config）          |
| **CLI 工具**      | `openclaw` 系列命令（英文输出）                          | 中文化 `onboard` 向导 + 中文友好错误提示                         |
| **语音唤醒**      | macOS + iOS（VoiceWake）                                 | ✅ 继承（建议在官方 App 中使用）                                 |
| **Canvas A2UI**   | ✅ Agent 驱动可视化工作区                                | ✅ 继承                                                          |
| **安装方式**      | curl 一键安装 / npm / Nix / Docker                       | ✅ 继承，额外提供中文化安装向导截图文档                          |
| **技能扩展**      | ClawHub 技能市场                                         | ✅ 继承（兼容 ClawHub）                                          |
| **文档语言**      | 英文（docs.openclaw.ai）                                 | 中文化关键功能说明 + 本 README 的完整中文使用教程                |
| **社区支持**      | Discord / GitHub                                         | GitHub + 中文开源社区（企微群等）                                |

---

### 🆙 本 Fork 额外新增能力（上游没有的）

| 新增特性                             | 说明                                                                                                   |
| :----------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **`[(deep_think)]` 修复**            | 修复了 Qwen-Web 和 DeepSeek 推理模型在长上下文或多轮 Tool Call 场景下的标签截断 / 溢出 bug             |
| **强制工具调用机制**                 | 修复了模型在长对话后遗忘 XML 工具格式的问题，通过隐式约束注入保持稳定唤起                              |
| **双 Agent 配置模板**                | 提供开箱即用的 Opus 主脑 + Kimi 副脑多 Agent 分工配置示例                                              |
| **`sandboxTaskPlanSuppressed` 修复** | 修复新建会话时侧边栏任务面板残留旧规划的 bug；新建后自动清空                                           |
| **前端 Session 状态管理**            | `/new` 命令后正确重置所有轮询状态，防止历史数据污染新会话                                              |
| **国内加速模型路由**                 | `moonshot` provider 直接接入，无需借助 OpenRouter 中转，降低延迟                                       |
| **Z ⇌ Z² + C 认知环流深度融合**      | 实现基于 `chaosScore` 与迭代深度的多智能体发散度检测与收敛控制，支持在陷入死循环时强制触发分形反思机制 |
| **A2UI 画布交互底座集成**            | 完整打通 Canvas A2UI 渲染链路（Agent to UI），引入基于高性能 `rolldown` 的前端构建流                   |
| **Dashboard 渲染热修复**             | 修复了由于 `lit` 模板依赖导入丢失导致的主控面板白屏（`ReferenceError`）与 WebSocket 连接容错机制       |

---

### 🧩 上游官方保留的核心能力（本 Fork 完整继承）

> 以下所有能力均来自上游 [openclaw/openclaw](https://github.com/openclaw/openclaw)，本 fork 完整继承：

- 🌐 **20+ 通信渠道**：WhatsApp、Telegram、Discord、Slack、Google Chat、Signal、iMessage、Feishu、LINE、Zalo 等
- 🔧 **本地设备控制**：浏览器 CDP 控制、终端 bash、文件读写、截图、摄像头
- 🤖 **Pi Agent 运行时**：RPC 工具流 + 流式输出，完整的会话模型
- 🛡️ **Docker 沙盒隔离**：非主会话自动走 Docker 沙盒执行
- 📱 **伴侣 App**：macOS 菜单栏 App + iOS/Android 节点
- ⏰ **Cron + Webhook 自动化**：定时任务、事件驱动执行流
- 🎙️ **Voice Wake + Talk Mode**：macOS/iOS 唤醒词 + Android 持续语音
- 🗺️ **Skills + ClawHub**：技能注册中心，支持 bundled/managed/workspace 技能
- 🔐 **Tailscale + SSH 远程网关**：安全暴露 Web UI，支持远程 Linux 机器部署

## ✨ 核心亮点 (Key Features)

| 模块名称               | 特性说明                                                                                                                      |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **全流程中文化界面**   | 从终端命令行的 `onboard` 到各种错误日志、高亮提示，全面采用了符合国人阅读习惯的中文语境与高亮色彩排版。                       |
| **原生大语言模型适配** | 针对国内顶级开源模型（Qwen、DeepSeek等）的 Web 接口与专属推理链路进行了特化适配，支持完整的深度思考过程展示与上下文工具对齐。 |
| **系统级本地设备控制** | 完美继承开源版本的所有高阶特性：直接在对话框中让 AI 帮你执行终端命令行、操作自动化浏览器、读写本地文件目录。                  |
| **多智能体与知识库**   | 原生支持多智能体协作流（Agent-to-Agent），自带多模态上下文记忆引擎与私有知识库挂载能力，支持长线任务的断点续传。              |
| **扩展通信渠道引擎**   | 计划对企微/微信等国内高频使用的社交与办公渠道进行原生接入开发（研发中），敬请期待！                                           |

## 🤖 深度解析：功能进化与使用指南 (Deep Dive)

OpenClaw 并非一个简单的对话窗口，而是一个具备**自主决策、长期记忆与多智能体协作**能力的数字员工。以下为最新核心功能的详细使用说明与能力进化对比。

---

### ⚡ 版本功能对比：更新前 vs 更新后（7 个维度）

| 能力维度          | ❌ 旧版本（Before）         | ✅ 新版本（After）                           |
| :---------------- | :-------------------------- | :------------------------------------------- |
| **对话模式**      | 被动问答，一问一答          | 自主工作台，任务自驱执行，AI 自行拆解目标    |
| **任务追踪**      | 靠用户自己记录进度          | AI 自动生成 `task.md` 并实时打卡每一步       |
| **高危操作拦截**  | 直接执行，无拦截            | `Human-in-the-loop` 弹窗强制人工审核后才继续 |
| **多 Agent 并行** | 单 Agent 串行，独占对话线程 | 多 Agent 并行，网关统一调度，全程不阻塞主脑  |
| **知识来源**      | 仅限本次对话上下文          | 支持挂载本地私有文档库、跨会话持久记忆       |
| **UI 语言**       | 英文界面，部分中文          | 全链路中文化，终端到 Web UI 极致贴合国人习惯 |
| **通信渠道**      | 仅 Web Dashboard            | Telegram 接入，企微 / 微信接入（研发中）     |

---

### 1. 💬 Chat: 拟人化自然交流与跨会话上下文记忆

每一次对话都会自动关联历史上下文。无论是中断后重连，还是长线任务的逐步推进，AI 都能像人类一样精确回忆起此前的边界条件与背景资料。

**示例对话（真实体验效果）：**

```
你：上次我让你分析的那个 typescript 配置文件，现在接着处理验证逻辑那部分。
AI：明白，我记得上次我们停在 zod-schema.agent-runtime.ts 的第 674 行，
    你让我分析 .strict() 模式下的 unknown field 风险。接下来我会：
    1. 继续扫描第 674 行之后的 Schema 定义...
    2. 重点关注 SafeParseAsync 场景下的错误传播路径...
```

**与官方版本的核心技术差异：**

| 技术细节                | 官方版本                  | 本 Fork                                            |
| :---------------------- | :------------------------ | :------------------------------------------------- |
| **深度思考标签解析**    | 基础展示，部分场景截断    | 修复 `[(deep_think)]`/`<think>` 在流式输出中的溢出 |
| **多轮 Tool Call 稳定** | 长对话后偶发忘记 XML 格式 | 注入隐式约束，强制保持工具调用格式稳定             |
| **中文模型推理链路**    | 主要优化 Claude/GPT 输出  | 专为 Qwen-Web / DeepSeek 流式输出深度适配          |

- **原生支持深度思考**：模型在给出最终回答前，会在后台进行自省与推理。
  ![Chat Demo](docs/assets/chat_page_demo_1772675215166.png)

---

### 2. 🧠 私有知识库挂载 (Knowledge Base)

无缝接入本地文档与代码库，告别"每次都要重新解释项目结构"的低效工作模式。

#### 快速开始（在对话框中直接说）：

> **"请把 `src/config/` 目录作为你的参考知识库，分析其中所有 `.ts` 文件的 Schema 结构，然后帮我找出最容易出现 `invalid config` 错误的字段定义。"**

更多快速提问模板：

```
# 挂载代码规范库
"请读取 CODING_STYLE.md，后续所有代码输出均需符合其中规范。"

# 挂载 API 文档
"请将 docs/api-reference/ 目录作为参考，帮我实现一个符合现有接口规范的新端点。"

# 断点续传
"上次我们分析到 subagent-registry.ts 的孤儿检测逻辑，现在继续看完整的 cleanup 流程。"
```

#### 4 项核心能力对照表：

| 能力             | 说明                                                                                    |
| :--------------- | :-------------------------------------------------------------------------------------- |
| **自主目录检索** | 智能体会自行调用 `list_dir`、`grep_search`、`view_file` 等工具翻阅目标文档              |
| **跨会话记忆**   | 核心文档内容被写入知识记忆（Knowledge Component），下次对话直接复用，无需重新加载       |
| **断点续传**     | 长任务中途中断后，AI 下次回来仍能接续，清楚知道上次读到哪里、做了什么                   |
| **私有规范遵守** | 将你自己的 `CODING_STYLE.md` 或 `ARCHITECTURE.md` 挂载进去，AI 会自动遵守团队规范写代码 |

---

### 2b. 🔬 上下文记忆架构深度解析（Memory Architecture Internals）

> 这是本 Fork 中「跨会话记忆」能力的技术原理说明。理解这个机制，才能正确使用 AI 的「记住上次...」能力。

#### 核心问题：LLM 的 Context Window 是有限的

每个模型都有一个上下文窗口上限（Context Window）：

| 模型                     | Context Window              |
| :----------------------- | :-------------------------- |
| Claude Opus 4 / Sonnet 4 | 1,048,576 tokens（1M）      |
| Qwen / DeepSeek          | 32K ~ 128K tokens           |
| 本地配置 override        | 可在 `openclaw.json` 自定义 |

对话越长，历史消息越多，token 用量不断累积。**一旦逼近上限，旧消息会被截断，AI 就"失忆"了**。

#### 三层记忆架构

```
┌──────────────────────────────────────────────────────── ┐
│  Layer 1：短期记忆（In-Session Transcript）              │
│  ● 本次对话所有消息，直接作为 prompt 传给模型          │
│  ● 消息越多，token 越多，直到逼近 context window 上限  │
└───────────────────────────┬─────────────────────────────┘
                            │ token 接近阈值时触发 ↓
┌──────────────────────────────────────────────────────── ┐
│  Layer 2：预压缩记忆落盘（Pre-Compaction Memory Flush）  │
│  ● AI 自动把当前重要信息写入 memory/YYYY-MM-DD.md      │
│  ● 然后进行 compaction：历史对话被压缩成摘要           │
│  ● Token 用量归零，继续工作                            │
└───────────────────────────┬─────────────────────────────┘
                            │ 下次对话开始时 ↓
┌──────────────────────────────────────────────────────── ┐
│  Layer 3：长期语义检索（Memory Search / QMD）            │
│  ● AI 强制先调用 memory_search(query) 检索历史记忆      │
│  ● 向量语义匹配 memory/*.md 中的相关片段               │
│  ● 将检索结果注入上下文，实现"跨会话记忆"             │
└─────────────────────────────────────────────────────────┘
```

#### 关键触发机制：Memory Flush（`memory-flush.ts`）

系统在每轮对话前评估是否需要触发 Memory Flush，触发条件为**任一满足**：

```
条件 A（Token 阈值）：
  当前预估 token 数 ≥ contextWindow - reserveTokens(预留) - softThreshold(默认 4000)

  等价公式：
  promptTokens + lastOutputTokens + 本轮输入估算 ≥ 阈值

条件 B（文件体积）：
  transcript 文件大小 ≥ 2MB（可配置 forceFlushTranscriptBytes）
```

触发后，系统向模型发送一个特殊的隐藏 prompt（用户不可见）：

```
Pre-compaction memory flush.
Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed).
IMPORTANT: If the file already exists, APPEND new content only and do not overwrite existing entries.
If nothing to store, reply with [SILENT].
```

模型收到后，会将当前对话中的重要信息**主动追加写入磁盘**到：

```
~/.openclaw/workspace/memory/
  └── 2025-03-07.md   ← 按日期分文件，内容 APPEND，不覆盖
```

#### 下次对话如何读取记忆（`memory-tool.ts`）

**每次对话开始前，AI 会被要求强制调用 `memory_search` 工具**（工具描述中标注了 `Mandatory recall step`）：

```typescript
// 工具描述（强制调用）
"Mandatory recall step: semantically search MEMORY.md + memory/*.md
 (and optional session transcripts) before answering questions about
 prior work, decisions, dates, people, preferences, or todos"
```

检索流程：

```
memory_search("上次我们停在哪里")
    │
    ▼
向量嵌入 → 语义匹配 memory/*.md 中所有片段
    │
    ▼
返回 top-N 结果（含 path + 行号 + 内容摘要）
    │
    ▼ 需要看完整内容时
memory_get("memory/2025-03-07.md", from=10, lines=30)
    │
    ▼
只拉取所需片段，避免把整个文件塞进上下文（节省 token）
```

#### 记忆的局限性（重要）

| 风险点              | 说明                                                                 |
| :------------------ | :------------------------------------------------------------------- |
| **AI 可能不写**     | 如果模型判断"本轮无值得保存的信息"，会回复 `[SILENT]` 跳过落盘       |
| **Compaction 有损** | 历史对话被摘要后，细节可能丢失；不是完整历史回放                     |
| **检索精度有限**    | `memory_search` 是向量语义检索，记忆很多时可能遗漏特定技术细节       |
| **沙盒限制**        | Sandbox 模式下 `workspaceAccess != "rw"` 时，Memory Flush 被自动禁用 |

#### 配置方式

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 8192, // compaction 时预留的最小 token 空间
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000, // 提前多少 token 触发 flush
          forceFlushTranscriptBytes: "2mb", // 按文件体积强制触发
          prompt: "...", // 自定义 flush 提示词（可选）
        },
      },
    },
  },
  memory: {
    citations: "auto", // "on" | "off" | "auto"（群组中默认关闭引用标注）
  },
}
```

> **实践建议**：对于长期需要"记住进度"的项目，建议在对话结束前主动说"请把我们今天的进展保存到记忆文件"，强制触发一次 Memory Flush，避免依赖系统的自动判断。

### 3. 🦞 Sandbox: 任务自动编排与高危拦截（Human-in-the-loop）

**核心进化：从"被动问答"到"自主工作台"**

```
┌───────────────────────────────────────────────┐
│            传统 Chat 模式（旧版）              │
│  你：帮我重构这个文件                          │
│  AI：好的，以下是我的建议... [给代码不执行]   │
└───────────────────────────────────────────────┘
                    ↓ 进化为

┌───────────────────────────────────────────────┐
│            Sandbox 自主工作台模式（新版）      │
│  你：帮我重构这个文件                          │
│  AI：[自动生成 task.md 规划文件]              │
│       ✅ Step 1: 读取文件结构 (view_file)     │
│       ✅ Step 2: 分析依赖关系 (grep_search)   │
│       🔄 Step 3: 修改代码（进行中...）        │
│       ⚠️ Step 4: git push【⏸ 等待人工审核】  │
└───────────────────────────────────────────────┘
```

#### 🛡️ Human-in-the-loop 高危拦截类型汇总表

当 AI 即将执行以下高风险操作时，系统会自动**挂起当前任务**，在 Sandbox 控制台弹出审核请求，等待用户明确授权：

| 高危操作类型     | 触发示例                                     |
| :--------------- | :------------------------------------------- |
| 递归删除文件     | `rm -rf ./dist`、`find . -delete`            |
| 强制写入系统目录 | `sudo cp ... /etc/`、`chmod 777 /usr/local`  |
| 网络发布/推送    | `git push origin main`、`npm publish`        |
| 服务重启         | `pm2 restart all`、`systemctl restart nginx` |
| 数据库危险操作   | `DROP TABLE`、`DELETE FROM users WHERE 1=1`  |

**完整任务示例（在 Sandbox 中下发宏大工作流）：**

```
请帮我完成以下完整工作流：
1. 分析 src/config/ 目录的全部 Schema 文件
2. 找出所有 .strict() 后的 unknown field 风险点
3. 生成一份中文说明文档到 docs/config-guide.md
4. 执行 git commit 并推送到 main 分支
```

AI 会自动打勾执行步骤 1-3，但到第 4 步（`git push`）时会**暂停并推送弹窗让你审核**，保障操作安全。

![Sandbox Demo](docs/assets/sandbox_page_demo_1772675227672.png)

---

### 4. 🤖 Multi-Agent: 多智能体并行协作大盘

**完整架构拓扑图：**

```
       你（用户）
         │  输入任务目标
         ▼
  ┌────────────────────────────────────────┐
  │  [ Gateway ] ← WebSocket 控制平面      │
  │   ws://127.0.0.1:18789                 │
  └──────────────┬─────────────────────────┘
                 │ sessions_send (A2A)
       ┌─────────▼──────────┐
       │    agent:main      │  ← 主脑决策层
       │ (Claude Opus / DeepSeek)   │    负责规划、分发与审核
       └───┬────────────────┘
           │ sessions_send (附带 sharedContext 记忆下发)
  ┌────────┼───────────┐
  ▼        ▼           ▼
[agent:kimi]  [Subagent-1]  [Subagent-2]
 中文沟通      后台代码执行   测试验证
 文档撰写      （并行）       （并行）
  │        │           │ 任务完毕后 `<updated_shared_context>` 回传
  └────────┴───────────┘
```

**技术实现核心机制（本 Fork 的深度扩展）：**

| 机制               | 说明                                                                                               |
| :----------------- | :------------------------------------------------------------------------------------------------- |
| **会话记忆穿透**   | **主代理可向下发 `sharedContext` 状态结构体，子任务完成后自动回传更新，达成记忆闭环**              |
| **持久化协作网络** | 支持 `mode: "session"` 创建常驻子智能体，记录专有上下文，并使用 `sessions_send` 进行持续跨线程通信 |
| **Z² 反思截流**    | 针对高频异常自动激活 `sessions_evaluate` 环路，主脑可唤起 Critic 评估者介入并阻断盲目死循环        |
| **A2A 策略控制**   | `tools.agentToAgent.enabled` + `allow` 列表精细管控跨 Agent 消息路由权限                           |
| **沙盒可见性守卫** | 沙盒化子任务只能访问同 Agent 内的 Session，杜绝越权调用                                            |
| **孤儿任务自愈**   | 检测并自动清理因网关重启导致的悬挂 subagent 记录（`reconcileOrphanedRestoredRuns`）                |
| **静默派发模式**   | `timeoutSeconds=0` 时立即返回 `accepted`，子任务完全在后台执行，主脑不等待                         |
| **子任务标签解析** | 支持按序号、label 前缀、sessionKey、runId 多种方式定位和操作子智能体                               |

#### 如何触发多智能体协作（直接在主脑对话框中说）：

**场景 A：静默派发后台任务（`timeoutSeconds=0`，完全不阻塞主脑）**

```
我正在测试后端逻辑，请你同时启动一个子智能体帮我在后台
重构 ui/src/ 目录的组件文件，完成后通知我，不要打断我现在的工作。
```

**场景 B：角色分工协作（主脑 + Kimi 副脑 + 子任务执行链）**

```
多智能体任务分工：
- 你（Opus）：分析 zod-schema.agent-runtime.ts 的架构，给出重构建议
- Kimi：把你的建议翻译成详细的中文使用说明文档
- 子智能体：按照建议执行实际的代码变更

请开始，遇到高危操作请先暂停等我审核。
```

**场景 C：并行执行多个独立子任务（真正的 Fork-Join 并发模型）**

```
请同时启动三个子智能体，并行完成以下三个独立任务：
1. 重构 ui/src/ui/views/chat.ts
2. 重构 ui/src/ui/views/sandbox.ts
3. 重构 ui/src/ui/views/agents.ts
每个任务完成后独立汇报状态，无需等待其他任务。
```

你可以在 **Overview 总览页**实时看到所有活跃 Agent 的心跳、Token 开销和执行状态：
![Overview Demo](docs/assets/overview_page_demo_1772675270234.png)
![Agents Demo](docs/assets/agents_page_demo_1772675299094.png)

---

### 5. ♾️ Z ⇌ Z² + C 认知环流深度融合 (Cognitive Loop Fusion)

**核心突破：赋予多智能体系统真正的“元认知”与“发散修正”能力**

在处理极其复杂的长时间维度任务时，传统的自主 Agent 往往容易陷入动作“死循环”——例如为了解决一个 Bug 不断地重复编辑和报错。本项目针对性地引入了基于复利折叠（Z ⇌ Z² + C）的监控环流：

- **`chaosScore` 混沌度量器**：底层的订阅分发中心（`pi-embedded-subscribe`）会实时监视动作指纹（Fingerprint）。当检测到 Agent 在原地打转或频繁报错时，会自动增加系统混沌值。
- **分形反思机制（Fractal Reflection）**：当混沌值越过安全阈值时，自动触发系统级侧入式钩子（Hooks）。强制打断当前发散的执行死循环（Divergence），并向主脑注入强力的人工提示，要求其调整方向或降维打击——例如指派具有特定上下文的子智能体（Subagent）去重新梳理问题，而不是一根筋死磕。

---

### 6. 💻 沉浸式中文 UI 交互体系（全面升级与修复）

#### 6 个界面模块的旧版 vs 新版体验对比

| 界面模块         | ❌ 旧版体验         | ✅ 新版体验                                               |
| :--------------- | :------------------ | :-------------------------------------------------------- |
| **终端向导**     | 英文 `onboard` 流程 | 全中文逐步向导，保留龙虾渐变色主题                        |
| **大语言模型层** | 仅官方海外模型      | Qwen、DeepSeek 深度思考全过程展示                         |
| **安全工具控制** | 仅显示一串返回代码  | 💬 **无塌陷的卡片追踪流，内联显示任务进度与网页快照摘要** |
| **浏览器自动化** | 每次执行前扫码登录  | 🌍 **自动关联绑定 Agent Session，跨任务免登持久化**       |
| **任务状态面板** | 英文 Task Status    | 中文实时任务进度条，集成了容错兜底渲染机制                |
| **配置面板**     | 英文字段说明        | 中文字段注释，支持在面板顶端安全无痕切换 `zh-CN`/`en`     |

**快速唤起控制台：**

```bash
# 打开图形化控制台（自动在浏览器中启动）
openclaw dashboard

# 或纯终端沉浸式模式
openclaw
```

**多 Agent 控制台访问地址清单：**

| 控制台入口 | 访问地址                                                     |
| :--------- | :----------------------------------------------------------- |
| 主脑 Chat  | `http://127.0.0.1:18789/chat?session=agent%3Amain%3Amain`    |
| Kimi 助手  | `http://127.0.0.1:18789/chat?session=agent%3Akimi%3Amain`    |
| 沙盘工作台 | `http://127.0.0.1:18789/sandbox?session=agent%3Amain%3Amain` |
| 智能体总览 | `http://127.0.0.1:18789/agents`                              |
| 全局总览   | `http://127.0.0.1:18789/overview`                            |

---

### 7. 🎨 Canvas A2UI 智能体可视化交互画布

**告别纯文本，所见即所得的动态前端组件输出**

不仅局限于 Markdown 文本，智能体现在能够无缝调用 `A2UI` (Agent to UI) 机制，直接在侧边栏为你渲染出高交互性的专属 Web 组件：

- **动态界面输出**：当描述需求时，AI 可直接甩出一个前端交互表单，甚至各类图表数据，取代传统的来回询问。
- **极速构建系统**：重构了底层的 Canvas 编译链，集成了新一代的 Rust 级打包器 `rolldown`。A2UI 的组件能够在毫秒级内完成打包与热更，并彻底修复了由于依赖丢失引起的白屏、WebSocket 断联等基础设施级 Crash，保障界面的丝滑流转。

## 🗺️ 发展路线图 (Roadmap)

- [x] CLI 终端向导演示流程的完全汉化。
- [x] 解决主流中文模型（Qwen、DeepSeek）在推理长文本和执行 Tool Calling 时的标签解析异常。
- [ ] (Next) 深度适配企微 / 微信等个人及企业通信渠道，逐步取代或并行国外的 Discord / Slack。
- [ ] (Next) 梳理和本土化所有的提示词系统组件库 (`AGENTS.md`, `TOOLS.md` 等)。

## 🤝 鸣谢与声明 (Acknowledgments & Disclaimer)

1. **项目归属声明**：本项目属于下游的本土化定制与优化分支，相关地址为：[luolin-ai/openclawWeComzh](https://github.com/luolin-ai/openclawWeComzh)。我们不对原项目导致的任何系统级风险（如使用 Bash 代理工具破坏本地环境）承担责任。
2. **上游社区致谢**：项目极度依赖并完全源于极致优秀的 [OpenClaw](https://github.com/openclaw/openclaw) 系统。所有的核心架构设计、精妙的 WebSockets 协议通信和前沿的 UI 渲染引擎均来自 `openclaw` 原生社区的无私奉献！特别感谢开源作者和社区无尽的探索。
3. **进阶技术参考**：如果你对 OpenClaw 底层的代理实现原理或插件化机制感兴趣，极其推荐阅读原版架构进阶文档：[OpenClaw Docs](https://docs.openclaw.ai/)。

<br />
<p align="center">
    <i>“用中国的语言，拥抱未来架构的个人 AI 助理”</i>
</p>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=openclaw/openclaw&type=date&legend=top-left)](https://www.star-history.com/#openclaw/openclaw&type=date&legend=top-left)

Run `openclaw doctor` to surface risky/misconfigured DM policies.

## 📚 上游官方功能全景图 (Upstream Highlights)

> 以下功能说明主要面向极客玩家与需要深度定制架构的开发者。
> 详情请查阅官方英文原版参考资料：[docs.openclaw.ai](https://docs.openclaw.ai)

本中文化分支不仅保留了上游官方库的核心能力，更是以 Gateway 为中心的全终端聚合系统：

- **[本地优先网关 (Local-first Gateway)](https://docs.openclaw.ai/gateway)** — 管理所有 Sessions、Channels、Tools 与事件分发的单点控制平面。
- **丰富的接入渠道 (Multi-channel)** — 支持将 Agent 连接到你的 WhatsApp, Telegram, Slack, Discord 等 20+ 个外部社交媒体平台。
- **系统底层控制台 (macOS/iOS App)** — Apple 全家桶原生支持：菜单栏快速呼出、全局语音唤醒 (Voice Wake)、持续对话 (Talk Mode) 与 Canvas 白板互动系统。
- **多终端节点联邦 (Nodes)** — 允许你的主节点通过 WebSockets 遥控其他闲置的 iOS/Android 设备，调用它们的摄像头采集或录屏能力。
- **远程暴露与安全防御 (Tailscale / SSH)** — 支持通过 Tailscale Serve/Funnel 将网关 Dashboard 暴露至公网，支持配置远程 Linux 网关与本地工作计算节点的拆分。
- **定时与事件钩子 (Cron & Webhooks)** — 允许通过发邮件 (Gmail Pub/Sub) 或调用 Webhook 让 Agent 自动触发某个脚本与工作流任务。
- **极客部署支持** — 除了提供基础 Node.js 源码级开发外，官方支持通过 Nix 的声明式配置安装，与全隔离架构的 Docker 镜像部署。
