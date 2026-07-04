<div align="center">

# 🌌 Open Infra Agent

**Give AI a Body. Run the Mind.**  
*The Digital Organism for Autonomous Agents.*

<p>

<a href="https://github.com/dotojr123/open-infro-agent-v04/stargazers">
<img src="https://img.shields.io/github/stars/dotojr123/open-infro-agent-v04?style=for-the-badge&logo=github&color=F59E0B">
</a>

<a href="LICENSE">
<img src="https://img.shields.io/github/license/dotojr123/open-infro-agent-v04?style=for-the-badge&logo=apache&color=10B981">
</a>

<a href="https://github.com/dotojr123/open-infro-agent-v04/issues">
<img src="https://img.shields.io/github/issues/dotojr123/open-infro-agent-v04?style=for-the-badge&logo=github&color=3B82F6">
</a>

<a href="https://github.com/dotojr123/open-infro-agent-v04/actions">
<img src="https://img.shields.io/github/actions/workflow/status/dotojr123/open-infro-agent-v04/ci.yml?style=for-the-badge&logo=github-actions&color=8B5CF6">
</a>

</p>

<br/>

![Open Infra Agent Demo](demo.gif)

<sub>☝️ <em>A real AI agent (Qwen) controlling a full Ubuntu desktop via MCP, observed in real time through the browser.</em></sub>

<br/>

🇺🇸 English | 🇧🇷 [Português (Brasil)](#-resumo-em-português)

</div>

---

## 🧠 The Disembodied Intelligence Problem
In 2026, building an intelligent AI agent is easy. Deploying one safely inside real-world infrastructure is not. 

Models like GPT-4o, Claude 3.5, and Gemini are incredibly smart, but they are essentially "brains in a jar". They can reason, but they lack a governable, physical-like environment to act. Most current frameworks attempt to solve this by either restricting the agent to a headless browser sandbox, or giving it dangerous, unauditable access to the host system.

**Open Infra Agent** is a governed, containerized **Autonomous Operating Environment (AOE)** for AI agents. We don't build the intelligence; we provide the **digital organism** where your AI lives, works, and acts safely.

---

## 🧬 The Anatomy of the Digital Organism
We mapped the biological necessities of a living organism into a highly performant, open-source infrastructure stack:

| Biology | Technical Implementation | Function in the Organism |
| :--- | :--- | :--- |
| **🧠 The Brain** | **Any LLM / Agent** | The intelligence (Claude, Gemini, DeepSeek). You bring the mind, we do the rest. |
| **👀 The Eyes** | [BrowserOS Integration](iagenciad/src/mcp/compressor.ts) | Visual perception. 65% compressed multimodal context, saving massive token costs. |
| **⚡ The Nervous System** | **MCP (Model Context Protocol)** | Connects the brain to the body. Zero glue code. 12ms execution roundtrip. |
| **✋ The Hands** | [Shell & OS Automation APIs](iagenciad/src/nut/nut.service.ts) | Real OS-level mouse, keyboard, and terminal manipulation capabilities. |
| **🫁 The Body (Skin)** | [Docker Containers](iagenciad/Dockerfile) | A fully isolated, disposable Ubuntu 22.04 workspace. Protects the host infrastructure. |
| **👁️‍🗨️ The Conscience** | [Audit Logs & Video Capture](iagenciad/src/input-tracking/input-tracking.service.ts) | Every click, command, and keystroke is structurally logged. No black boxes. |
| **🧑‍⚕️ The Supervision** | **Human-in-the-loop (noVNC)** | Watch the agent live in your browser. Pause, take over the mouse, and hand it back. |

---

## 🚀 The Cockpit vs. The Engine
A common question we get is: *"How does this compare to workspaces like Odysseus or Open WebUI?"*

They are not competitors; they are complementary. Projects like Odysseus act as the **Cockpit** (the chat interface and multi-user dashboard). **Open Infra Agent is the Engine.** 

$$\text{User} \longrightarrow \text{Odysseus (Cockpit)} \longrightarrow \text{Agent Framework} \longrightarrow \text{Open Infra Agent (The Organismo / Body)}$$

We provide the heavy infrastructure layer where the actual execution happens behind the scenes.

---

## 🛡️ Current Limitations & Roadmap (v0.1)
We believe in absolute technical honesty. Open Infra Agent is designed for defense-in-depth, but we are currently at **v0.1**:

* **✅ Currently Active:** Container namespace isolation, visual sandboxing, and `execFile` injection-safe input routing.
* **🚧 Coming in v0.2:** Strict Seccomp profiles (system call whitelisting), cgroups v2 limits (to prevent CPU/RAM resource exhaustion by agents), and append-only tamper-evident audit logs.

---

## ⚡ Performance Profile
Tested on our standard runtime stack:
* **Start Latency:** `~3.5 seconds` — from `docker compose up` to a fully responsive, visual MCP-accessible environment.
* **Execution Roundtrip:** `~12ms` — from MCP tool call to OS-level input driver.
* **Idle RAM Footprint:** `~240MB` — entire X11 + XFCE4 + noVNC + NestJS stack.

---

## 🛠️ Quick Start

**1. Clone and Boot:**
```bash
git clone https://github.com/dotojr123/open-infro-agent-v04.git
cd open-infro-agent-v04
docker compose up --build -d
```

**2. Watch the Organism Live:**  
Open your browser and navigate to:  
👉 **`http://localhost:9990/vnc`**

**3. Connect Your Agent (The Brain):**  
Choose your preferred MCP connection:

#### A. BrowserOS MCP Server (Recommended)
Exposes 60+ advanced browser automation tools (tab management, navigation, interactions) directly from the agentic browser:
👉 **`http://localhost:9000/mcp`**

**Claude Desktop Configuration (`claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "browseros": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "http://localhost:9000/mcp"]
    }
  }
}
```

#### B. System Controller MCP Server
Exposes OS-level tools (mouse, keyboard, and terminal control):
👉 **`http://localhost:9990/mcp`**


---

## 🏗️ Architecture: Execution Runtime Platform (v4)

**Open Infra Agent** has been completely refactored to support a modular 3-tier architecture. Docker is no longer mandatory; the platform operates on multiple environments (Docker, Linux, Windows, macOS, Android/Termux, SSH, PRoot, etc.) via dynamic runtime capability negotiation.

```
       [ Mission Layer ]         <-- Objective planning, agent tool logic
               │
               ▼
      [ Execution Layer ]        <-- Sessions, Event Bus, Command Pipelines, Failover
               │
               ▼
       [ Runtime Layer ]         <-- Local, Docker, PRoot, SSH execution plugins
```

### Core Architecture Components:
- **Mission Layer**: Defines goals and MCP tools (`computer_*`).
- **Execution Layer**:
  - **Execution Sessions**: Provides workspace isolation for concurrent runs, preventing directory conflict.
  - **Command Pipeline**: Intercepts, validates, and logs commands against a safety blacklist.
  - **Event Bus**: Publishes telemetry and lifecycle events (`SessionCreated`, `FailoverTriggered`).
- **Runtime Layer**: Conforms runtime hosts (`LocalRuntime`, `DockerRuntime`, etc.) to unified specialized engines (`FilesystemEngine`, `ProcessRunner`, `InputController`, `DisplayController`).
- **Auto-Failover**: Automatically checks active runtime health and transitions to fallback runtimes without state disruption.

---

## 🇧🇷 Resumo em Português

**Open Infra Agent** é o organismo digital para agentes autônomos.

Hoje, modelos como ChatGPT e Claude são apenas "cérebros presos em uma jarra". Eles têm a inteligência, mas não têm um corpo para agir com segurança no mundo real. Nós resolvemos isso fornecendo um Ambiente Operacional Autônomo (AOE) completo.

Nós entregamos o corpo (contêineres Ubuntu isolados), o sistema nervoso (MCP nativo), as mãos (APIs de automação de mouse/teclado) e os olhos (BrowserOS). Tudo isso com Supervisão Humana em Tempo Real (Human-in-the-Loop) via navegador, permitindo que equipes de DevOps e Segurança auditem e assumam o controle do agente a qualquer momento.

---

## 📄 License

**Open Infra Agent** is built to make autonomous AI execution observable, governable, and safe.  
Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

This project is a premium, hardened fork of [Bytebot](https://github.com/bytebot-ai/bytebot) — Copyright Bytebot AI, Apache-2.0. We thank the original authors for their outstanding contribution to the open-source community.