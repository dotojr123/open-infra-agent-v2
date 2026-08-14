# ─── Stage 1: Build Frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY cockpit/frontend/package*.json ./
RUN npm install

COPY cockpit/frontend/ ./
RUN npm run build

# ─── Stage 2: Build Backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build/backend

COPY cockpit/backend/package*.json ./
RUN npm install

COPY cockpit/backend/ ./
RUN npm run build

# ─── Stage 3: Production Image ───────────────────────────────────────────────
# node:20-slim (Debian/glibc), não alpine: faster-whisper/ctranslate2 (STT local,
# mesmo motor que o Hermes usa) tem extensões nativas C++ sem build musl/Alpine.
FROM node:20-slim
WORKDIR /app

# python3 + faster-whisper: transcrição de voz local (subprocesso por request,
# sem processo residente — ver cockpit/backend/src/stt.ts).
ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir faster-whisper

# Cacheia os pesos do modelo Whisper dentro do volume já persistido (/app/data),
# pra não baixar de novo a cada rebuild/redeploy da imagem.
ENV HF_HOME=/app/data/hf-cache

# Codex CLI — provider "codex" no Cockpit roda isto como subprocesso,
# autenticado via conta ChatGPT (ver /root/.codex, persistido em volume)
RUN npm install -g @openai/codex

# Copy backend runtime (compiled JS + deps)
COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY cockpit/backend/scripts ./scripts

# Copy compiled frontend into backend's public dir (served as static files)
COPY --from=frontend-builder /build/frontend/dist ./public

# AGENTS.md — instruções de projeto lidas automaticamente pelo Codex CLI
# (provider "codex") a partir do WORKDIR /app, ensinando as tools computer_*
# do MCP "iagencia" para controlar o desktop VNC.
COPY cockpit/AGENTS.md ./AGENTS.md

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
