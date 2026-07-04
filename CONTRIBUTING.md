# Contributing to IAgencia Desktop

First off, thank you for considering contributing to **IAgencia Desktop**! It's people like you who make this a world-class open-source automation framework.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## 🛠️ Local Development Setup

IAgencia Desktop uses a **monorepo** structure powered by **npm Workspaces**.

### Prerequisites

* **Node.js**: `>= 20.0.0`
* **npm**: `>= 10.0.0`
* **Docker & Docker Compose** (for containerized testing)
* **Native Build Tools** (for compiling native modules locally if you aren't using Docker):
  * **Linux (Debian/Ubuntu)**:
    ```bash
    sudo apt-get install -y cmake build-essential git \
      libx11-dev libxtst-dev libxinerama-dev libxi-dev \
      libxt-dev libxrandr-dev libxkbcommon-dev libxkbcommon-x11-dev \
      xclip
    ```
  * **Windows / macOS**: Local compilation of native dependencies is complex due to X11 library requirements. **Using Docker for local development is highly recommended on these platforms.**

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/dotojr123/open-infro-agent-v04.git
   cd open-infro-agent-v04
   ```
2. Install monorepo dependencies and link packages:
   ```bash
   npm install
   ```
3. Build the shared packages:
   ```bash
   npm run build:shared
   ```
4. Run the daemon locally (if you are on a compatible Linux environment):
   ```bash
   npm run start:dev
   ```

---

## 🐳 Dockerized Development (Recommended)

To run the full suite (NestJS API + XFCE4 Virtual Desktop + VNC) inside a container:

1. Build the local image:
   ```bash
   npm run docker:build
   ```
2. Start the stack:
   ```bash
   npm run docker:up
   ```
3. Access the services:
   * **NestJS API & SSE**: `http://localhost:9990`
   * **Virtual VNC Desktop (noVNC)**: `http://localhost:9990/vnc/` (or via proxy)
4. View the logs:
   ```bash
   npm run docker:logs
   ```
5. Tear down:
   ```bash
   npm run docker:down
   ```

---

## 🎨 Architecture Overview

The codebase is split into two packages under the root directory:

* `/shared`: Typings, schema validation, and shared data objects.
* `/iagenciad`: The core NestJS daemon running the API, MCP endpoints, and interacting with native layers (`@nut-tree-fork/nut-js` and `uiohook-napi`).

---

## 🧪 Coding Standards & PR Guidelines

* **Code Style**: Ensure you run `npm run lint` and format your files correctly.
* **Typing**: Keep types strict. Avoid using `any` unless absolutely necessary.
* **Commit Messages**: Use clear, concise commit summaries (e.g. `feat: add mouse scroll inertia support`, `fix: sanitize path injection risk`).
* **Pull Requests**:
  1. Fork the repo and create your branch from `main`.
  2. Implement your feature/bugfix.
  3. Verify everything builds and passes tests locally.
  4. Submit your PR and describe your changes.
