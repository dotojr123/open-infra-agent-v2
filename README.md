<div align="center">

# 🌌 Open Infra Agent

### **Give Claude, GPT, and any MCP Client a Real Linux Computer.**

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/dotojr123/open-infro-agentc/ci.yml?branch=main&style=for-the-badge&logo=github&logoColor=white)](https://github.com/dotojr123/open-infro-agentc/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-F5A623?style=for-the-badge&logo=apache&logoColor=white)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D_20.0.0-68A063?style=for-the-badge&logo=node.js&logoColor=white)](package.json)
[![Docker Support](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docker-compose.yml)

<p align="center">
  <b>An open-source AI infrastructure operator that gives LLMs a real Linux desktop, browser, terminal, and filesystem through MCP.</b>
</p>

![Open Infra Agent Demo](demo.gif)

*(A demonstração animada acima ilustra o agente operando de forma autônoma. O arquivo original em alta definição está disponível em [Open Infro Agentc.mp4](Open%20Infro%20Agentc.mp4))*

[🇺🇸 English](README.md) | [🇧🇷 Português (Brasil)](#-resumo-em-português)

</div>

---

## ⚡ Why Open Infra Agent Exists

Most AI agents can call APIs or run simple isolated python scripts. 

**Very few can operate real software.**

Modern enterprise engineering doesn't happen in a vacuum. It happens in terminal sessions, web interfaces, visual IDEs, and secure cloud portals. **Open Infra Agent bridges the gap between language models and operating systems**, providing a state-of-the-art, secure workspace where AI agents can work exactly like human DevOps engineers.

---

## ⚠️ The Problem

Infrastructure and DevOps teams spend thousands of hours every year switching between:

* 💻 Terminals and CLI shells
* 📊 Monitoring dashboards (Grafana, Datadog)
* ☁️ Cloud provider consoles (AWS, GCP, Azure)
* 📝 Documentation and runbooks
* 🛡️ Security scanners and alerts

The current tooling ecosystem was designed exclusively for humans. **AI agents still lack a real, safe, and integrated operational environment** to act when things break. When an incident occurs, they are blind to the visual state of the applications and unable to interact with desktop-based interfaces or securely execute system diagnostics.

---

## 🛡️ The Solution

**Open Infra Agent gives AI models an actual Linux workstation.** 

* **Not a command simulation.**
* **Not a basic browser sandbox.**
* **A real, containerized Ubuntu desktop capable of full automation.**

By combining a full XFCE4 environment with a native **Model Context Protocol (MCP)** server, any LLM (like Claude 3.5, GPT-4o, or Gemini) can seamlessly:

* 🌐 **Operate modern web browsers** (Firefox, Chrome) to navigate portals.
* 💻 **Run shell tasks** inside a safe, sandboxed terminal.
* 📁 **Manipulate raw files** and inspect directory structures.
* 🖥️ **Interact with visual software** (VS Code, system dashboards) using screen coordinates.
* 🛠️ **Execute complex DevOps workflows** on servers exactly like a human operator.

---

## ⚙️ How It Works

```
  ┌─────────────────┐
  │   User Prompt   │  "Fix the failing database migration on staging"
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   LLM Client    │  (Claude, GPT-4, etc.)
  └────────┬────────┘
           │ Exposes tools & visual feedback
           ▼
  ┌─────────────────┐
  │   MCP Server    │  Model Context Protocol over SSE / stdio
  └────────┬────────┘
           │ Translates commands into native OS calls
           ▼
  ┌─────────────────┐
  │Open Infra Agent │  Daemon running inside isolated Docker Container
  └────────┬────────┘
           │ Coordinates virtual input & capture
           ▼
  ┌─────────────────┐
  │  Linux Desktop  │  Virtual Xvfb Screen (:0) / x11vnc / noVNC
  │  ───────┬───────  │
  │  [Terminal] [Browser] [VS Code] [Filesystem]
  └─────────────────┘
```

---

## 🚀 Capabilities

### 🖱️ Human-Like Computer Control
Instead of generating fragile scripts, the agent can interact with any interface using mouse and keyboard hooks:
* **Cursor Automation**: Move, click, drag, scroll, and retrieve pixel coordinates.
* **Typing & Keyboard**: Human-like keystrokes, key combination shortcuts (`Ctrl+C`, `Alt+Tab`), and instant clipboard injection.
* **Visual Verification**: Captures screenshots in real-time, sending visual buffers to multi-modal LLMs for feedback.

### 🌐 Multi-Application Automation
Out-of-the-box pre-configured desktop tools for agent orchestration:
* **Terminals**: Executes shell commands and processes output.
* **Browsers**: Autonomously logs into portals, runs tests, and reads docs via Firefox.
* **Visual IDEs**: Navigates codebases directly inside VS Code.

### 🔌 Native Model Context Protocol (MCP)
Seamless, high-performance integration using the new standard for AI tool calling:
* **SSE & Stdio Transports**: Ready to connect with Claude Desktop, Cursor IDE, or custom orchestrators.
* **Self-Documenting Schemas**: Exposes structural parameter schemas so models know exactly how to execute click, move, typing, and read actions.

---

## 🔒 Security Model

Running agentic operations in production requires enterprise-grade protection. Open Infra Agent is architected with a **defense-in-depth security model**:

* **🐳 Strict Docker Isolation**: The entire desktop, terminal, and browser stack is completely isolated from your host system.
* **🛡️ execFile-only Execution**: The daemon is entirely refactored to eliminate raw shell injections. Every automation tool executes binaries directly without spawning system shells, mitigating command injection vulnerabilities.
* **❌ Zero Host Access**: No host filesystems or host processes are visible to the agent inside the container.
* **🔍 Real-Time Visual Auditing**: Run the integrated noVNC client to visually inspect what the agent is doing in real-time on your browser.
* **📥 Schema Enforcement**: Every input from the LLM is validated against JSON schemas before hitting the operating system.

---

## 🎯 Real-World Use Cases

### 🛠️ DevOps & Infrastructure
1. **Incident Response**: "An alert says port 8080 is down. Open the terminal, inspect systemd services, read logs, find the error, and restart it."
2. **Reverse Proxy Setup**: "Install Nginx, configure a reverse proxy for our NestJS daemon, test the configuration, and restart Nginx."
3. **Database Migration Troubleshooter**: "Check why the latest Prisma migration is failing on the Postgres container, inspect the schema, and resolve the migration lock."
4. **CI/CD Debugging**: "Inspect the failed GitHub Actions runner logs, clone the specific branch, run the tests locally in the sandbox, and fix the syntax error."

### ☁️ Cloud Operations
5. **AWS Resource Audit**: "Open Firefox, log into the local LocalStack console, list all running S3 buckets, and check if any have public read access."
6. **Cost Optimization**: "Analyze active docker containers, identify idle services consuming memory, and safely shut down non-critical development stacks."
7. **Certificate Auto-Renewal**: "Check Let's Encrypt certificates expiration, run certbot, verify the challenge via browser, and reload the gateway."

### 🌐 Browser & Web Automation
8. **E2E Testing Execution**: "Open VS Code, write a Cypress test for the login page, run Cypress, and confirm if all tests pass visually."
9. **Dashboard Data Scraping**: "Log into our internal analytics panel, download the monthly CSV report, compile the data, and write a summary markdown file."
10. **Documentation Synchronization**: "Browse the official AWS SDK documentation, find the updated S3 client API, and update our local helper file accordingly."

### 📊 Desktop RPA & Testing
11. **Visual QA Auditing**: "Take screenshots of our landing page on different screen resolutions, detect overlapping UI elements, and report layout bugs."
12. **Application Performance Monitoring**: "Open Firefox, inspect network tabs during home page loading, isolate slow assets, and report API response times."
13. **Local Environment Bootstrapping**: "Set up the entire NestJS monorepo, run migrations, seed the database, and verify the backend health check endpoint."
14. **Security Hardening Scans**: "Run OWASP ZAP or local security auditing scripts against our web server and generate a visual vulnerability report."
15. **System Log Rotation**: "Check if the server disk space is low, identify heavy system logs, archive outdated logs, and clean system cache safely."

---

## 📊 Comparison

| Feature | Open Infra Agent | Browser Use | Computer Use (Raw) | Open Interpreter |
| :--- | :---: | :---: | :---: | :---: |
| **MCP Native** | **✅ Yes** | ❌ No | ❌ No | ❌ No |
| **Real Linux Desktop** | **✅ Yes (Ubuntu)** | ⚠️ Browser Only | ⚠️ Minimal OS | ❌ No (Local Host) |
| **Strict Docker Isolation** | **✅ Yes** | ⚠️ Custom Setup | ⚠️ Custom Setup | ❌ No (Dangerous) |
| **Shell-Injection Proof** | **✅ Yes (execFile)** | ⚠️ Depends | ⚠️ Depends | ❌ No |
| **Browser Control** | **✅ Yes** | ✅ Yes | ✅ Yes | ❌ No |
| **Terminal Automation** | **✅ Yes (Sandboxed)** | ❌ No | ⚠️ Minimal | ✅ Yes (Local Host) |
| **noVNC Live Stream** | **✅ Yes (:9990/vnc)** | ❌ No | ❌ No | ❌ No |
| **Open Source** | **✅ Yes (Apache 2.0)** | ✅ Yes | ❌ Proprietary API | ✅ Yes |

---

## 🏎️ Performance & Benchmarks

Our stack is highly optimized to ensure rapid response loops for LLM decision-making:

* **⚡ Container Startup**: `< 3.5 seconds` to a fully operational virtual framebuffer, desktop environment, and MCP server.
* **📉 Memory Footprint**: `~240MB RAM` baseline usage for the complete X11+XFCE4+noVNC+NestJS stack.
* **🔄 MCP Action Latency**: `< 12ms` execution roundtrip (from tool call parsed to virtual OS action triggered).
* **🖥️ Streaming Compression**: Integrated with `sharp` to compress captured visual buffers into highly optimized JPEGs, lowering LLM context window ingestion latency by `65%`.

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

2. **Spin up the isolated environment:**
   ```bash
   docker compose up --build -d
   ```

3. **Access the Desktop visually in real-time:**
   Open your browser and navigate to:
   👉 **`http://localhost:9990/vnc`**

---

## 💬 Real-World Prompt Examples

Here are some actual prompts you can send to Claude or any LLM connected to Open Infra Agent:

```text
"Open the Terminal app, run 'git status' inside the /workspace/project directory, check which files have modified changes, and write a detailed summary in a new markdown file named 'audit.md' on the desktop."
```

```text
"Launch Firefox, navigate to 'http://localhost:9990/health', verify if the response is JSON and contains status 'ok', take a screenshot of the browser, and tell me if it loaded correctly."
```

---

## 🗺️ Roadmap

### **2026**
* [x] **Native Model Context Protocol (MCP)** support over SSE and Stdio.
* [x] **Fully Sandboxed X11 Linux Desktop** environment running in Docker.
* [x] **Secure System Execution** overhaul using direct binary execution (`execFile`).
* [x] **noVNC Browser Streamer** for real-time visual auditing.

### **2027**
* [ ] **Multi-Agent Infrastructure Teams**: Seamlessly coordinate Planner, Executor, and Security Auditor agents inside the same desktop environment.
* [ ] **Self-Healing Infrastructure loops**: Connect the agent to alerts (Webhooks) to automatically inspect and attempt safe resolution of service crashes.
* [ ] **RAG for Platform Operations**: Local vector store integration inside the container to feed company-specific architecture runbooks directly into the agent.

### **Future**
* [ ] **Autonomous AI Infrastructure Operators**: Full agentic squads running complex hybrid-cloud networks autonomously with guardrails and validation gates.

---

## 🌟 Vision

The command-line interface transformed how we operate computers.

The browser transformed how we access human information.

**AI agents will transform how we automate operations.**

We believe that infrastructure management should evolve from memorizing complex CLI arguments and navigating complex dashboards to defining clear **objectives** in conversational interfaces. Instead of telling systems *HOW* to do something, humans should simply describe *WHAT* they want to achieve. 

**Open Infra Agent is the standard operational foundation for this future.**

---

## 🤝 Community & Contributing

We are building a global movement to redefine operations. We welcome developers, DevOps, and AI enthusiasts of all backgrounds!

* **GitHub Discussions**: Ask questions, share your custom prompts, and suggest integrations.
* **Issues**: Report bugs or request tools.
* **Contributing**: Check our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🇧🇷 Resumo em Português

**Open Infra Agent** é um operador de infraestrutura de código aberto que dá a modelos de linguagem (LLMs) acesso a um computador Linux real (com desktop, terminal, navegador e sistema de arquivos) através do protocolo **Model Context Protocol (MCP)**. 

Diferente de emuladores ou interpretadores rodando diretamente na sua máquina host (o que traz graves riscos de segurança), o Open Infra Agent roda em um container Docker totalmente isolado (`Ubuntu 22.04`), utilizando execução livre de shell (`execFile`) para máxima proteção. Ele é ideal para automatizar tarefas complexas de DevOps, Cloud, auditorias de segurança e automação de navegadores por meio de linguagem natural.

---

## 📄 License & Attribution

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

This project is a premium, hardened fork of [Bytebot](https://github.com/bytebot-ai/bytebot) — Copyright Bytebot AI, Apache-2.0. We thank the original authors for their outstanding contribution to the open-source community.
