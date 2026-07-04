#!/bin/bash
set -e

echo "Starting Multi-VNC Environment..."

# Function to start VNC for a user
start_user_vnc() {
    LOCAL_USER=$1
    LOCAL_DISPLAY=$2
    LOCAL_VNC_PORT=$3
    LOCAL_WEB_PORT=$4
    
    echo "Setting up VNC for $LOCAL_USER on display $LOCAL_DISPLAY..."
    
    # Kill existing processes
    pkill -u $LOCAL_USER -f "x11vnc.*$LOCAL_VNC_PORT" || true
    pkill -f "websockify.*$LOCAL_WEB_PORT" || true
    
    # Create Xauthority if not exists
    if [ ! -f /home/$LOCAL_USER/.Xauthority ]; then
        touch /home/$LOCAL_USER/.Xauthority
        chmod 600 /home/$LOCAL_USER/.Xauthority
        chown $LOCAL_USER:$LOCAL_USER /home/$LOCAL_USER/.Xauthority
    fi
    
    # Copy Xauth cookie from root if display exists
    if xauth list :$LOCAL_DISPLAY >/dev/null 2>&1; then
        COOKIE=$(xauth list :$LOCAL_DISPLAY | awk '{print $3}')
        if [ ! -z "$COOKIE" ]; then
            xauth -f /home/$LOCAL_USER/.Xauthority add :$LOCAL_DISPLAY MIT-MAGIC-COOKIE-1 $COOKIE
            chown $LOCAL_USER:$LOCAL_USER /home/$LOCAL_USER/.Xauthority
        fi
    fi
    
    # Check if Xvfb is running for this display
    if ! pgrep -f "Xvfb.*:$LOCAL_DISPLAY" >/dev/null; then
        echo "Starting Xvfb for $LOCAL_USER..."
        su - $LOCAL_USER -c "Xvfb :$LOCAL_DISPLAY -screen 0 1280x720x24 -ac -nolisten tcp &"
        sleep 2
    fi
    
    # Start x11vnc as the user
    echo "Starting x11vnc for $LOCAL_USER..."
    su - $LOCAL_USER -c "x11vnc -display :$LOCAL_DISPLAY -auth /home/$LOCAL_USER/.Xauthority -N -forever -shared -rfbport $LOCAL_VNC_PORT -passwd iagencia -noxdamage -noxfixes &"
    sleep 2
    
    # Start websockify
    echo "Starting websockify on port $LOCAL_WEB_PORT..."
    websockify --web=/usr/share/novnc/ $LOCAL_WEB_PORT localhost:$LOCAL_VNC_PORT &
    sleep 1
    
    echo "Done for $LOCAL_USER"
}

# Start VNC for each user
start_user_vnc agent1 1 5901 6081
start_user_vnc agent2 11 5911 6011

echo "All VNC sessions started!"
echo "Access:"
echo "  agent1: http://$(hostname -I | awk '{print $1}'):6081/vnc.html"
echo "  agent2: http://$(hostname -I | awk '{print $1}'):6011/vnc.html"
