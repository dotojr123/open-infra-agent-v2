<div align="center">

# 🌌 Open Infra Agent

### **The Operating Environment for Autonomous AI Agents.**

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/dotojr123/open-infro-agentc/ci.yml?branch=main&style=for-the-badge&logo=github&logoColor=white)](https://github.com/dotojr123/open-infro-agentc/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-F5A623?style=for-the-badge&logo=apache&logoColor=white)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D_20.0.0-68A063?style=for-the-badge&logo=node.js&logoColor=white)](package.json)
[![Docker Support](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docker-compose.yml)

<p align="center">
  <b>Run AI agents inside fully isolated Linux workspaces with complete visibility, human supervision, live intervention, and enterprise-grade control.</b>
</p>

✓ **Total Visibility** — Watch every click, keystroke, and terminal operation in real-time.  
✓ **Human-in-the-Loop** — Seamlessly intervene, pause, or take over keyboard and mouse control instantly.  
✓ **Strict Isolation** — Run agents in disposable Docker-sandboxed environments with zero host exposure.  
✓ **Multi-Stakeholder VNC** — Let DevOps, Security, and Compliance audit the same session simultaneously.  
✓ **Native MCP Integration** — Direct standard connection via Model Context Protocol.

<br/>

![Open Infra Agent Demo](demo.gif)

*(A demonstração animada acima ilustra a execução sob observabilidade total. O vídeo original em alta definição está disponível como [Open Infro Agentc.mp4](Open%20Infro%20Agentc.mp4))*

[🇺🇸 English](README.md) | [🇧🇷 Português (Brasil)](#-resumo-em-português)

</div>

---

## ⚡ Why Open Infra Agent Exists

In 2026, building an AI agent has become a commodity. 

**The real challenge is governance.** 

How do organizations deploy autonomous agents to operate complex, real-world software without:
* Losing visual visibility of their actions?
* Risking catastrophic commands executing directly on host production servers?
* Lacking standard audit trails and compliance reports?
* Losing the ability for a human engineer to step in and take over when a pipeline goes wrong?

Existing agent frameworks focus on APIs, browsers, or local execution. **Open Infra Agent focuses on providing a complete, secure operating environment where AI agents can work safely, transparently, and under strict human supervision.**

---

## ⚠️ The Paradigm Shift: The Governance Layer

In the traditional setup, agents connect directly to sensitive environments through raw tool calls:

```
  ┌───────────┐      Exposes direct access      ┌────────────────┐
  │ AI Agent  ├────────────────────────────────►│ Production OS  │
  └───────────┘    (Unsupervised, raw exec)    └────────────────┘
```
* **Critical Risks**: Command injections, black-box execution, zero visual verification, zero rollback control, and strict liability on compliance.

Open Infra Agent introduces the **Operational Governance Layer**:

```
  ┌───────────┐      Controlled MCP Tools      ┌───────────────────────┐
  │ AI Agent  ├───────────────────────────────►│  Open Infra Agent     │
  └───────────┘                                │  (Docker Sandbox Workspace)
                                               └──────────┬────────────┘
                                                          │ 
                                                          ├─► [Real-Time VNC Stream] ──► DevOps & Audit
                                                          ├─► [Human Intervention]  ───► Live Takeover
                                                          ▼
                                               ┌───────────────────────┐
                                               │ Secure Remote Actions │
                                               └───────────────────────┘
```
This guarantees absolute isolation, real-time supervision, multi-stakeholder monitoring, and human-in-the-loop override capability.

---

## 🚀 Key Governance Pillars

### 👁️ Complete Visibility
**See everything the agent sees.** Open Infra Agent records and streams the virtual environment in real-time. DevOps and audit teams can inspect every cursor movement, active terminal keystroke, active browser session, and modified filesystem directory.

### 🤝 Human-in-the-Loop (Live Intervention)
**Take control whenever needed.** The system doesn't run in a black box. If an agent gets stuck, enters an infinite loop, or is about to execute an unintended operation, a human operator can instantly step into the session, override mouse/keyboard inputs, resolve the block, and let the agent continue.

### 🐳 Isolated Execution Workspaces
Agents work in disposable, containerized Linux workspaces. The agent cannot reach your host network, filesystems, or cloud keys unless you explicitly grant permission.

### 👥 Multi-Stakeholder Access
A single active agent session can be monitored simultaneously by multiple roles inside your company:
* **DevOps Team**: Monitors workflow execution correctness.
* **Security & Compliance Team**: Audits commands and permission boundaries live.
* **Management**: Tracks task completion status visually.

---

## ⚙️ How It Works

```
  ┌─────────────────┐
  │   User Prompt   │  "Diagnose staging build and configure visual assets"
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   AI Agent      │  (Claude, GPT-4, Llama, custom orchestrator)
  └────────┬────────┘
           │ Exposes tools & visual feedback
           ▼
  ┌─────────────────┐
  │   MCP Server    │  Model Context Protocol (SSE / Stdio)
  └────────┬────────┘
           │ Translates commands into secure virtual OS actions
           ▼
  ┌─────────────────┐
  │Open Infra Agent │  Daemon running inside isolated Docker Container
  └────────┬────────┘
           │ Coordinates input hook translation & frame compression
           ▼
  ┌─────────────────┐
  │ Linux Workspace │  Virtual Xvfb Screen (:0) / x11vnc / noVNC
  │  ───────┬───────  │
  │  [Terminal] [Browser] [VS Code] [Filesystem]
  └─────────────────┘
```

---

## 📦 What Agents Can Do (Capabilities)

### 🖱️ Human-Like Computer Control
* **Virtual Mouse & Keyboard**: Execute clicking, dragging, scrolling, natural typing, and system shortcuts (`Ctrl+C`, `Alt+Tab`).
* **Visual Verification Buffer**: Captures X11 framebuffers in real-time, compressing frames into highly optimized payloads to feed multimodal LLMs for instant visual validation.

### 🌐 Multi-Application Orchestration
* **Secure Terminal sessions**: Execute shell commands, isolate execution outputs, and parse logs safely.
* **Full Browser Control**: Autonomously browse documentation, log into administration portals, and audit dashboards using Firefox.
* **Integrated VS Code**: Browse directories and modify local configuration files visually inside an active IDE session.

### 🔌 Standardized Model Context Protocol (MCP)
* Connects instantly with Claude Desktop, Cursor IDE, LangGraph, CrewAI, or custom orchestrators.
* Self-documenting tool definitions enforce strict schema validation on coordinates, text inputs, and files.

---

## 🔒 Defense-in-Depth Security Model

Deploying autonomous execution requires production-grade safeguards:

* **🛡️ execFile-only Execution**: The agent daemon uses zero system shell wrapping. By calling system commands through direct binary execution (`execFile`), we eliminate an entire class of shell injection vulnerabilities by avoiding shell invocation entirely.
* **🐳 Namespace & Kernel Isolation**: Container boundaries ensure the agent can never break out into host processes.
* **🔍 Audit Trail Logs**: Complete logs of every visual change, filesystem read/write, and terminal execution are preserved for post-incident reviews.
* **📥 Schema Constraints**: Coordinate parameters and typed strings are parsed against strict JSON schemas before being executed by virtual drivers.

---

## 💬 Live Operational Examples

Watch how you can converse with agents operating inside the secure workspace:

### 🛠️ System Diagnostics
> *"Open the Terminal app, check if local PostgreSQL service is accepting connections, find any active query locks, and output a diagnostic report to the desktop."*

### 🌐 Cloud Portal Audit
> *"Launch Firefox, go to local console dashboard, verify that all SSL configurations are green, take a screenshot of the main status widget, and notify me if there are active errors."*

### 📁 Filesystem Cleanups
> *"Search the /var/log directory for raw log files modified in the past hour. If there are massive trace files, archive them, clean the cache directory, and verify disk space stats."*

### 💻 Code Review & Local Hotfix
> *"Open VS Code in /workspace, check why the main server integration test is failing, locate the syntax error in the configuration class, fix it, and rerun the test suite visually."*

---

## 🎯 Enterprise Use Cases

### 🛠️ Safe DevOps & Operations
* **Autonomous Incident Resolution**: Safely inspect system logs, restart failed systemd units, and run visual recovery playbooks.
* **Automated Environment Verification**: Spin up dependencies locally, run tests, and check status dashboards through the virtual browser.
* **Local Proxy Bootstrapping**: Deploy local Nginx configurations, verify reverse proxies visually, and audit active ports.

### ☁️ Cloud & Resource Governance
* **Security & Port Auditing**: Run automated scanners against sandboxed configurations, compile logs, and identify potential vulnerabilities.
* **Resource Optimization**: Locate dormant docker containers and idle memory processes, compiling performance charts.

### 🌐 Browser RPA & Auditing
* **End-to-End Visual QA**: Validate user onboarding flows, screenshot responsiveness layouts, and capture rendering errors.
* **Governance Log Integration**: Access internal management dashboards, download reports, compile records, and sync documentation safely.

---

## 📊 Why Open Infra Agent is Different

Instead of comparing features against specific transient frameworks, the core difference lies in architectural focus:

✓ **Governance-First** — Designed from the ground up to enforce strict security boundaries, rigid schema validation, and complete container isolation.
✓ **Human-in-the-Loop** — Built so humans can visually monitor and override inputs instantly, eliminating execution anxiety in production environments.
✓ **Visual Supervision** — Direct low-latency real-time video streaming of agent activities, not just basic text logs.
✓ **Multi-Stakeholder Access** — Multiple roles (DevOps, Security, Compliance, Management) can monitor and audit the exact same execution session simultaneously.
✓ **Isolated Workspaces** — Disposable containerized desktop environments preventing any threat of host filesystem compromise.
✓ **MCP-Native** — Native, standard integration with the Model Context Protocol.

---

## ❓ FAQ

### Is Open Infra Agent a heavy Virtual Machine (VM)?
No. It runs entirely inside an optimized Docker container utilizing a virtual X11 framebuffer (Xvfb). You get the operational visual workspace of a full Ubuntu desktop at a fraction of VM system resources (`~240MB RAM`).

### Can a human take over the agent's work mid-execution?
Yes. That is the core pillar of our operational model. Through the VNC stream (`http://localhost:9990/vnc`), a human operator can watch the agent work and immediately type or click to override inputs, fix a block, and let the agent resume.

### Does it require MCP to run?
No. The platform comes with a native MCP server for SSE or Stdio connections, but also fully exposes standard REST APIs for custom orchestrations.

### How is it safe from malicious scripts?
Everything runs strictly isolated in the Docker container namespace. Even if the agent attempts to delete root directories, it only impacts its disposable environment, leaving your host system and production data completely untouched.

---

## 🏎️ Performance Profile (Typical Specifications)

These representative metrics illustrate the highly optimized nature of the runtime stack under standard hardware environments:

* **⚡ Start Latency**: `~3.5 seconds` baseline from zero to a fully responsive, visual MCP-accessible operating environment.
* **📉 RAM Footprint**: `~240MB RAM` baseline memory utilization for the entire inactive/active X11+XFCE4+noVNC+NestJS stack.
* **🔄 Execution Roundtrip**: `~12ms` trigger speed from tool call parser to OS virtual input driver.
* **🖥️ Context Ingestion Compression**: Integrated with `sharp` to scale and compress frame buffers, cutting context window ingestion payloads by `65%` on multimodal models.

---

## 🚀 Quick Start (1-Minute Launch)

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### Launch 

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dotojr123/open-infro-agentc.git
   cd open-infro-agentc
   ```

2. **Spin up the environment:**
   ```bash
   docker compose up --build -d
   ```

3. **Access the session visually:**
   Open your browser and navigate to:
   👉 **`http://localhost:9990/vnc`**

---

## 📡 API & MCP Tool Reference

### REST Endpoints
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/vnc` | `GET` | Redirects to the integrated noVNC web view |
| `/health` | `GET` | Container health probe check |
| `/computer-use` | `POST` | Exposes low-level OS automation APIs |
| `/mcp` | `GET/POST` | Standard MCP connection endpoint (SSE) |

### Exposes High-Performance OS Automation Tools:
* 🖱️ **Cursor Automation**: `computer_move_mouse`, `computer_click_mouse`, `computer_press_mouse`, `computer_drag_mouse`, `computer_cursor_position`, `computer_scroll`.
* ⌨️ **Keyboard Automation**: `computer_type_text` (typing effect), `computer_paste_text` (instant clipboard injection), `computer_type_keys` (shortcuts like `Ctrl+C`, `Alt+Tab`).
* 🖥️ **Application Controllers**: `computer_application` (launches/focuses VS Code, Terminal, Firefox, 1Password, etc.).
* 📁 **Secure File System Tools**: `computer_write_file`, `computer_read_file` (handles base64 encoded streams safely).

---

## 🗺️ Roadmap

### **2026**
* [x] **Native Model Context Protocol (MCP)** support over SSE and Stdio.
* [x] **Fully Sandboxed X11 Linux Desktop** environment running in Docker.
* [x] **Secure System Execution** overhaul using direct binary execution (`execFile`).
* [x] **noVNC Browser Streamer** for real-time visual auditing.

### **2027**
* [ ] **Multi-Agent Collaboration**: Coordinate Planner, Executor, and Security Auditor agents inside the same desktop environment.
* [ ] **Self-Healing Infrastructure loops**: Connect the agent to alerts (Webhooks) to automatically inspect and attempt safe resolution of service crashes.
* [ ] **RAG for Platform Operations**: Local vector store integration inside the container to feed company-specific architecture runbooks directly into the agent.

### **Future**
* [ ] **Autonomous AI Infrastructure Operators**: Full agentic squads running complex hybrid-cloud networks autonomously with guardrails and validation gates.

---

## ⚡ Why This Matters

Software was designed for humans.

Applications expect clicks. Browsers expect navigation. Terminals expect commands. Operating systems expect users.

AI agents are now capable of reasoning about complex tasks, but they still lack a standardized operating environment.

**Open Infra Agent introduces a missing layer:**

A secure operational workspace where agents can execute tasks, humans can supervise every action, and organizations can deploy autonomous systems safely.

Just as containers standardized application deployment (Docker/Kubernetes), Agent Operating Environments may standardize autonomous execution.

---

## 🌟 Vision

The first wave of AI focused on generating content.

The second wave focused on calling isolated API tools.

**The third wave is about autonomous execution.**

But autonomous execution requires something that does not exist today: a secure, auditable, and human-supervised operating environment designed specifically for AI agents.

Open Infra Agent was created to become that environment. A place where agents can operate real software, human operators can supervise every single action, and organizations can deploy AI agents safely at scale.

---

## 🤝 Community & Contributing

We are building a global movement to redefine operations. We welcome developers, DevOps, and AI enthusiasts of all backgrounds!

* **GitHub Discussions**: Ask questions, share your custom prompts, and suggest integrations.
* **Issues**: Report bugs or request tools.
* **Contributing**: Check our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🇧🇷 Resumo em Português

**Open Infra Agent** é um ambiente operacional completo de código aberto para agentes autônomos (Agent Operating Environment). Ele permite rodar agentes de IA dentro de espaços de trabalho Linux (`Ubuntu 22.04`) totalmente isolados via Docker, com visibilidade completa, supervisão humana (Human-in-the-Loop), intervenção em tempo real e controle corporativo.

Diferente de interpretadores locais ou plugins simples de navegador que abrem brechas de segurança críticas em suas máquinas, o Open Infra Agent roda em um container seguro usando execução `execFile` sem shell. Ele expõe uma área de trabalho real (terminal, navegador Firefox, VS Code) controlável por linguagem natural via **Model Context Protocol (MCP)**, permitindo que múltiplos setores de uma empresa (Segurança, DevOps e Auditoria) monitorem visualmente as ações do agente simultaneamente no navegador.

---

## 📄 License & Attribution

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

This project is a premium, hardened fork of [Bytebot](https://github.com/bytebot-ai/bytebot) — Copyright Bytebot AI, Apache-2.0. We thank the original authors for their outstanding contribution to the open-source community.
