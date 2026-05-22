# IAgencia Desktop

**Agente de desktop AI** que automatiza tarefas de computador através de comandos em linguagem natural, operando dentro de um ambiente Linux desktop containerizado.

> Baseado no projeto open-source [Bytebot](https://github.com/bytebot-ai/bytebot) (Apache-2.0), customizado e mantido pela **IAgencia**.

---

## 🚀 Quick Start

### Com Docker Compose (recomendado)

```bash
git clone https://github.com/iagencia/iagencia-desktop.git
cd iagencia-desktop
docker compose up --build -d
```

Acesse o desktop no navegador:
```
http://localhost:9990/vnc
```

### Com Docker direto

```bash
docker build -t iagencia-desktop:latest -f iagenciad/Dockerfile .
docker run -d --name iagencia-desktop -p 9990:9990 iagencia-desktop:latest
```

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Container Linux                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │   Xvfb   │→ │  x11vnc  │→ │  noVNC/websockify │  │
│  │ Display  │  │  VNC srv │  │   :6080 → :5900   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│       ↓                              ↑               │
│  ┌──────────┐                  ┌─────────────┐       │
│  │  XFCE4   │                  │  iagenciad  │       │
│  │ Desktop  │    ←──────────── │  NestJS API │       │
│  │          │    mouse/kbd     │   :9990     │       │
│  └──────────┘    via libnut    │  + MCP SSE  │       │
│                                └─────────────┘       │
│  Apps: Firefox, VS Code, 1Password, Thunderbird      │
└─────────────────────────────────────────────────────┘
         ↕ porta 9990
    ┌──────────┐
    │ Browser  │  ← Usuário / Agente AI
    │  ou LLM  │
    └──────────┘
```

---

## 📡 API Endpoints

| Endpoint | Método | Descrição |
|---|---|---|
| `/vnc` | GET | Redireciona para o desktop noVNC |
| `/novnc/` | GET | Serve arquivos estáticos do noVNC |
| `/computer-use` | POST | Executa ações de mouse/teclado/screenshot |
| `/input-tracking/start` | POST | Inicia rastreamento de input do usuário |
| `/input-tracking/stop` | POST | Para rastreamento de input |
| `/mcp` | SSE | Endpoint MCP (Model Context Protocol) |

### Ações disponíveis via `/computer-use`

| Ação | Descrição |
|---|---|
| `move_mouse` | Move o cursor para coordenadas x,y |
| `click_mouse` | Clique simples/duplo/triplo |
| `drag_mouse` | Arrastar e soltar |
| `scroll` | Scroll em qualquer direção |
| `type_text` | Digita texto caractere por caractere |
| `paste_text` | Cola texto via clipboard |
| `type_keys` | Atalhos de teclado (ex: Ctrl+C) |
| `screenshot` | Captura screenshot do desktop |
| `cursor_position` | Retorna posição atual do cursor |
| `application` | Abre/foca aplicação (firefox, vscode, etc.) |
| `write_file` | Escreve arquivo (base64) |
| `read_file` | Lê arquivo (retorna base64) |

### MCP Tools

O endpoint `/mcp` expõe as mesmas ações como **MCP tools**, permitindo integração direta com LLMs compatíveis (Claude, etc.):

```
computer_move_mouse, computer_click_mouse, computer_scroll,
computer_type_text, computer_paste_text, computer_type_keys,
computer_screenshot, computer_cursor_position, computer_application,
computer_write_file, computer_read_file, computer_drag_mouse,
computer_trace_mouse, computer_press_mouse, computer_press_keys,
computer_wait
```

---

## 📁 Estrutura do Projeto

```
iagencia-desktop/
├── shared/              ← Tipos e utilitários compartilhados
│   └── src/
│       ├── types/       ← ComputerAction, MessageContent types
│       └── utils/       ← Type guards e conversores
├── iagenciad/           ← Daemon principal (NestJS)
│   ├── Dockerfile       ← Build da imagem completa
│   ├── src/
│   │   ├── mcp/         ← MCP server tools
│   │   ├── computer-use/← Serviço de automação desktop
│   │   ├── input-tracking/← WebSocket de rastreamento
│   │   └── nut/         ← Interface com libnut (mouse/kbd)
│   └── root/            ← Overlay do filesystem
│       ├── etc/         ← Configs (supervisor, firefox, etc.)
│       └── usr/share/   ← Backgrounds, .desktop files
├── docker-compose.yml
└── assets/              ← Logos e ícones
```

---

## 🔧 Desenvolvimento

### Pré-requisitos
- Docker & Docker Compose
- Node.js 20+ (para desenvolvimento local)

### Build local (sem Docker)
```bash
# Shared
cd shared && npm install && npm run build

# Daemon
cd ../iagenciad && npm install && npm run build
npm run start:dev
```

---

## 📄 Licença

Este projeto é distribuído sob a licença **Apache-2.0**.

Baseado no [Bytebot](https://github.com/bytebot-ai/bytebot) — Copyright Bytebot AI, Apache-2.0.
