import subprocess
import os

# Start roberto websockify
subprocess.Popen(
    ['websockify', '--web=/usr/share/novnc/', '6080', 'localhost:5900'],
    stdout=open('/home/roberto/websockify_6080.log', 'w'),
    stderr=subprocess.STDOUT,
    start_new_session=True
)

# Start agent1 websockify
subprocess.Popen(
    ['sudo', '-u', 'agent1', 'websockify', '--web=/usr/share/novnc/', '6081', 'localhost:5901'],
    stdout=open('/home/roberto/websockify_6081.log', 'w'),
    stderr=subprocess.STDOUT,
    start_new_session=True
)
print('Websockify processes launched in detached mode!')
