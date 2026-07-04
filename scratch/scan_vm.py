import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.159.128', username='roberto', password='20011982.')

commands = [
    'echo "=== VNC Processes ==="',
    'ps aux | grep -i vnc | grep -v grep',
    'echo "=== Websockify Processes ==="',
    'ps aux | grep -i websockify | grep -v grep',
    'echo "=== Active Listening Ports ==="',
    'ss -tuln | grep -E "(59|60)[0-9][0-9]"'
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode("utf-8"))

ssh.close()
