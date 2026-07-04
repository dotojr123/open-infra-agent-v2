#!/bin/bash
# VNC Session Setup Script

LINUX_USER=$1
LINUX_PASS=$2
VNC_PASS=$3
DISPLAY_NUM=$4
VNC_PORT=$5
WEB_PORT=$6

if [ -z "$LINUX_USER" ]; then
    echo "Usage: setup_vnc_session.sh <user> <linux_pass> <vnc_pass> <display> <vnc_port> <web_port>"
    exit 1
fi

echo "Setting up VNC session for $LINUX_USER..."

# Create user if not exists
if ! id "$LINUX_USER" &>/dev/null; then
    sudo useradd -m -s /bin/bash "$LINUX_USER"
    echo "$LINUX_USER:$LINUX_PASS" | sudo chpasswd
    echo "$LINUX_USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$LINUX_USER
fi

# Setup VNC password
mkdir -p /home/$LINUX_USER/.vnc
echo "$VNC_PASS" | vncpasswd -f > /home/$LINUX_USER/.vnc/passwd
chmod 600 /home/$LINUX_USER/.vnc/passwd
chown -R $LINUX_USER:$LINUX_USER /home/$LINUX_USER/.vnc

# Create xstartup
cat > /home/$LINUX_USER/.vnc/xstartup <<EOF
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec openbox-session &
xterm -geometry 80x24+10+10 -ls -title "Terminal" &
EOF
chmod +x /home/$LINUX_USER/.vnc/xstartup
chown $LINUX_USER:$LINUX_USER /home/$LINUX_USER/.vnc/xstartup

# Kill existing processes for this display/user
pkill -u $LINUX_USER -f "Xvfb :$DISPLAY_NUM" || true
pkill -u $LINUX_USER -f "x11vnc.*$VNC_PORT" || true
pkill -f "websockify.*$WEB_PORT" || true
sleep 1

# Start Xvfb
sudo -u $LINUX_USER Xvfb :$DISPLAY_NUM -screen 0 1280x720x24 -ac -nolisten tcp &

# Start x11vnc
sudo -u $LINUX_USER x11vnc -display :$DISPLAY_NUM -N -forever -shared -rfbport $VNC_PORT -passwd $VNC_PASS &

# Start websockify with noVNC web root
websockify --web=/usr/share/novnc/ $WEB_PORT localhost:$VNC_PORT &

echo "VNC session started for $LINUX_USER on display :$DISPLAY_NUM"
echo "Access: http://\: $WEB_PORT/vnc.html"

