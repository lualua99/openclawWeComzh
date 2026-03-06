# OpenClaw 中文多智能体增强版 (OpenClaw-Zh)

<p align="center">
  <img src="https://raw.githubusercontent.com/steipete/openclaw/main/assets/brand/openclaw-banner.png" alt="OpenClaw Logo" width="100%">
</p>
<p align="center">
  <b>专为中文办公生态与复杂多智能体协作打造的增强方案</b>
</p>

## 🌟 项目简介

OpenClaw-Zh 是基于 [官方 OpenClaw](https://github.com/steipete/openclaw) 深度定制的分支版本。在保留了原版强大的多平台互通（Omnichannel）和模型代理架构基础上，我们重点针对**中文企业办公生态**、**复杂长链条的多代理（Multi-Agent）任务场景**以及**浏览器前端安全与观测环境**进行了全方位的核心能力增强。

无论您是需要一个全天候的微信/飞书/企微 AI 助理，还是需要统筹多个子代理协同完成深度网页调研、代码分析等长周期任务，OpenClaw-Zh 都能为您提供更稳健、更直观、更符合本地化使用习惯的智能体底座。

---

## 🚀 核心增强能力与优势

### 💻 1. 中文本地生态深度接入

**解决痛点**：官方版本主要面向国外协同软件（Discord, Slack 等），国内由于网络或习惯原因使用门槛高，且难以融入现有的企业数字化办公协作流。

**能力提升**：

- **原生级平台接入支持**：深度适配并且优化了**企业微信 (WeCom)**、**个人微信**、**飞书 (Feishu)** 等国内主流通讯平台。
- **抖音内容生态接入**：增强了对抖音等本地化特定内容平台的数据获取与搜索交互能力。
- **零摩擦落地体验**：只需要简单的 Token 映射配置，您的团队即可在熟悉的国内办公软件中直接 `@` 智能体并分发任务。

### 🧠 2. 高级多智能体协作架构 (Multi-Agent Orchestration)

**解决痛点**：传统单体大模型在处理复杂、跳跃性强或长周期的任务时（例如：调研并总结数十个关联网页后结合本地数据撰写报告）容易遭遇上下文窗口溢出、逻辑断层或遗忘初始指令。

**能力提升**：

- **记忆回传与状态继电器机制**：我们在子代理体系中引入了全新的级联记忆同步功能。主控代理能够生成结构化的专属上下文（SharedContext）下发给子代理；同时，子代理在结束独立的探索任务（如网页调查、深度搜索或代码分析）后，会将提炼后的**核心状态与记忆无缝同步回传**给主控代理。
- **高容错的任务链条**：这种“分而治之，汇总延展”的接力机制极大避免了嵌套任务中的上下文丢失，使得多步骤、长跨度、跨领域的复杂任务调度变得可用且极为强健。

### 🌐 3. 浏览器与自动化观测环境增强

**解决痛点**：代理在代表用户进行深度网页调研或后台抓取操作时，经常遭遇会话拦截、频繁需要手动登录授权验证；并且后台操作由于过程缺乏可视化，对于用户而言就像是一个“黑盒”，难以判断执行进度或受阻原因。

**能力提升**：

- **会话状态全自动持久化 (Persistent Profile)**：系统自动实现了浏览器环境配置与任务 Session 的隔离与持久化关联映射。智能体在被召唤时可以自动复用对应环境下已存在的登录态（Cookies、LocalStorage），彻底告别反复扫码或账号被临时注销的窘境。
- **可视化全息控制台 (Chat UI 增强)**：我们在 Web 端控制台中引入了**浏览器工具流的内联渲染组件**。当 AI 在后台截取网页快照或发生交互导致页面变动时，UI 对话流中将会**直接内联展示目标网页的高清截图**及精炼的快照树数据。这让您清晰、实时、直观地观测 AI 的决策“视野”与操作即时反馈。

---

## 🏃 快速上手 (Quick Start)

**环境要求**：`Node.js >= 20` , `pnpm` 或 `npm`

### 1. 安装与初始化

```bash
git clone https://github.com/luolin-ai/openclawWeComzh.git
cd openclawWeComzh
npm install
# 或首推使用 pnpm install
```

### 2. 环境配置

复制一份默认的环境配置模版为 `.env` 文件，并填入必要的信息（如 LLM API Key，以及所需的飞书/企微 Secret）：

```bash
cp .env.example .env
```

基础 `.env` 配置示例：

```env
# 大模型通道配置 (例如 DeepSeek, OpenAI 兼容)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxx
OPENAI_BASE_URL=https://api.deepseek.com/v1 # 示例：替换为您喜爱的大模型基座地址

# 中文前端渠道配置 (按需开启对应的频道配置，详看具体服务模块)
WECOM_CORP_ID=xxx
WECOM_CORP_SECRET=xxx
```

### 3. 启动项目

```bash
npm run dev
# 或 pnpm run dev
```

### 4. 访问观测台 (Dashboard)

控制台启动成功后，浏览器访问 `http://localhost:3000` 进入 Web Chat UI 控制台，您可以直接在该前台发起对话，调试增强后的多智能体工作流并直观欣赏其浏览器交互成果。

---

## 📚 进阶配置与官方全量参考说明

为了保持本说明的清晰与聚焦，详细的底层架构接口原理、生产环境部署选项（Docker / Systemd / Remote Node）、以及多余数十种原版系统支持的通讯渠道（Slack / Discord / iMessage / Matrix 等）的具体配置，请参阅官方提供的全面英文版文档，我们将不在本仓库文档内作冗长展开：

<details>
<summary><b>点击展开查阅官方基础架构及文档合集</b></summary>

- [官方使用文档库首页 (Docs Index)](https://docs.openclaw.ai)
- [底层系统架构设计图与概览 (Architecture)](https://docs.openclaw.ai/concepts/architecture)
- [全量配置参数参考字典 (Configuration)](https://docs.openclaw.ai/gateway/configuration)
- [多平台 Gateway 与路由器的部署运维指南 (Operations)](https://docs.openclaw.ai/gateway)
- [安全审查与远程访问配置 (Security & Remote Access)](https://docs.openclaw.ai/gateway/security)
- [TypeBox Data Schema 定义与 Agent 事件循环原理透析](https://docs.openclaw.ai/concepts/agent-loop)

</details>

---

## 🤝 鸣谢与生态演进

本项目的诞生和成长，建立在开源社区巨人肩膀和所有参与者的智慧之上。
诚挚鸣谢 [steipete/openclaw](https://github.com/steipete/openclaw) 展现出的杰出原始架构、超前设计视野以及基础生态支持。

不论您是期望带来更丝滑的中文化适配方案、更多有趣的国内聚合平台接入尝试，还是提升高难度子代理任务容错率的架构畅想，我们热切欢迎您来提交 Issue、交流建议和递交 Pull Request！

> 🤖 Let the Claw automate the boring, focus on the spark.
