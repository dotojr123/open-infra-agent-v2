# -----------------------------------------------------------------------------
# IAgencia Desktop Dockerfile - Virtual Desktop Environment
# -----------------------------------------------------------------------------
# AI-powered desktop automation agent running in a containerized Linux desktop.
# Based on the Bytebot open-source project (Apache-2.0).
# Customized and rebranded by IAgencia.
# -----------------------------------------------------------------------------

# Base image
FROM ubuntu:22.04

# -----------------------------------------------------------------------------
# 1. Environment setup
# -----------------------------------------------------------------------------
# Set non-interactive installation
ARG DEBIAN_FRONTEND=noninteractive
# Configure display for X11 applications
ENV DISPLAY=:0

# -----------------------------------------------------------------------------
# 2. System dependencies installation
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y \
    # X11 / VNC
    xvfb x11vnc xauth x11-xserver-utils \
    x11-apps sudo software-properties-common \
    # Desktop environment 
    xfce4 xfce4-goodies dbus wmctrl \
    # Display manager with autologin capability
    lightdm \
    # Development tools
    python3 python3-pip curl wget git vim \
    # Utilities
    supervisor netcat-openbsd \
    # Applications
    xpdf gedit xpaint \
    # Libraries
    libxtst-dev \
    # Remove unneeded dependencies
    && apt-get remove -y light-locker xfce4-screensaver xfce4-power-manager || true \
    # Clean up to reduce image size
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /run/dbus && \
    # Generate a machine-id so dbus-daemon doesn't complain
    dbus-uuidgen --ensure=/etc/machine-id

# -----------------------------------------------------------------------------
# 3. Additional software installation
# -----------------------------------------------------------------------------

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip3 install --upgrade pip

# Install BrowserOS
RUN BROWSEROS_DEB_URL=$(curl -s https://api.github.com/repos/browseros-ai/BrowserOS/releases | grep browser_download_url | grep -o 'https://.*\.deb' | head -n 1) && \
    if [ -n "$BROWSEROS_DEB_URL" ]; then \
    echo "Downloading BrowserOS from $BROWSEROS_DEB_URL" && \
    curl -sSL "$BROWSEROS_DEB_URL" -o /tmp/browseros.deb && \
    apt-get update && \
    apt-get install -y /tmp/browseros.deb && \
    if [ -f /usr/share/applications/browseros.desktop ]; then \
    sed -i 's|Exec=/usr/bin/browseros|Exec=/usr/bin/browseros --no-sandbox|g' /usr/share/applications/browseros.desktop; \
    fi && \
    rm -f /tmp/browseros.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*; \
    else \
    echo "BrowserOS download URL not found" && exit 1; \
    fi


# -----------------------------------------------------------------------------
# 4. VNC and remote access setup
# -----------------------------------------------------------------------------
# Install noVNC and websockify (pinned to stable releases for reproducibility)
RUN git clone --branch v1.5.0 --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone --branch v0.12.0 --depth 1 https://github.com/novnc/websockify.git /opt/websockify \
    && cd /opt/websockify \
    && pip3 install --break-system-packages .

# -----------------------------------------------------------------------------
# 5. Application setup (iagenciad)
# -----------------------------------------------------------------------------
# Install dependencies required to build libnut-core and uiohook-napi
RUN apt-get update && \
    apt-get install -y \
    cmake \
    libx11-dev \
    libxtst-dev \
    libxinerama-dev \
    libxi-dev \
    libxt-dev \
    libxrandr-dev \
    libxkbcommon-dev \
    libxkbcommon-x11-dev \
    xclip \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY ./shared/ /iagencia/shared/
COPY ./iagenciad/ /iagencia/iagenciad/
WORKDIR /iagencia/iagenciad

# IMPORTANT: Do NOT use --build-from-source here!
# sharp ships pre-built binaries that work out of the box.
# Using --build-from-source forces sharp to compile from source,
# which fails because Ubuntu 22.04's libvips (8.12) is too old
# for sharp@0.34.x (requires libvips >= 8.15).
RUN npm install

# Selectively rebuild ONLY the native modules that need source compilation
RUN npm rebuild uiohook-napi --build-from-source

RUN npm run build

# Build custom libnut-core for better X11 integration
WORKDIR /compile

RUN git clone --depth 1 https://github.com/ZachJW34/libnut-core.git && \
    cd libnut-core && \
    npm install && \
    npm run build:release

# Replace libnut.node with compiled version
RUN rm -f /iagencia/iagenciad/node_modules/@nut-tree-fork/libnut-linux/build/Release/libnut.node && \
    cp /compile/libnut-core/build/Release/libnut.node /iagencia/iagenciad/node_modules/@nut-tree-fork/libnut-linux/build/Release/libnut.node

RUN rm -rf /compile

WORKDIR /iagencia/iagenciad

# -----------------------------------------------------------------------------
# 7. User setup and autologin configuration
# -----------------------------------------------------------------------------
# Create non-root user
RUN useradd -ms /bin/bash user && echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /var/run/dbus && \
    chmod 755 /var/run/dbus && \
    chown user:user /var/run/dbus

RUN mkdir -p /tmp/iagencia-screenshots && \
    chown -R user:user /tmp/iagencia-screenshots

# -----------------------------------------------------------------------------
#  Copy staged system files and keep sane permissions
# -----------------------------------------------------------------------------
RUN chown -R root:root /iagencia/iagenciad/root && \
    find /iagencia/iagenciad/root -type f -exec chmod 644 {} + && \
    find /iagencia/iagenciad/root -type d -exec chmod 755 {} + && \
    find /iagencia/iagenciad/root -type f -executable -exec chmod +x {} + && \
    cp -a /iagencia/iagenciad/root/. /

RUN chown -R user:user /home/user
RUN chmod -R 755 /home/user

RUN mkdir -p /home/user/Desktop && \
    cp -f /usr/share/applications/terminal.desktop /home/user/Desktop/ && \
    cp -f /usr/share/applications/browseros.desktop /home/user/Desktop/ 2>/dev/null || true && \
    if [ -f /home/user/Desktop/browseros.desktop ]; then \
    sed -i 's|Exec=/usr/bin/browseros|Exec=/usr/bin/browseros --no-sandbox|g' /home/user/Desktop/browseros.desktop; \
    fi && \
    chmod +x /home/user/Desktop/*.desktop && \
    chown user:user /home/user/Desktop/*.desktop

RUN mkdir -p /home/user/.config /home/user/.local/share /home/user/.cache \
    && chown -R user:user /home/user/.config /home/user/.local /home/user/.cache

WORKDIR /home/user

# -----------------------------------------------------------------------------
# 8. Port configuration and runtime
# -----------------------------------------------------------------------------
# - Port 9990: iagenciad and external noVNC websocket
EXPOSE 9990

# Health check to verify the NestJS API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:9990/health || exit 1

# IAgencia Desktop metadata
LABEL org.opencontainers.image.title="iagencia-desktop"
LABEL org.opencontainers.image.description="IAgencia Desktop - AI-powered desktop automation agent in a containerized Linux environment"
LABEL org.opencontainers.image.source="https://github.com/iagencia/iagencia-desktop"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.vendor="IAgencia"

# Start supervisor to manage all services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf", "-n"]

