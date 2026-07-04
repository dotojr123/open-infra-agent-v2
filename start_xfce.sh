#!/bin/bash
export DISPLAY=:0
Xvfb :0 -screen 0 1280x960x24 -ac -nolisten tcp &
sleep 3
dbus-launch --exit-with-session startxfce4 &
sleep 5
x11vnc -display :0 -N -forever -shared -rfbport 5900 &
sleep 3
nohup websockify 6080 localhost:5900 >/dev/null 2>&1 &
echo "XFCE and noVNC startup triggered!"
