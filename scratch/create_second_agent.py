import time
import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # We separate background commands with newlines instead of '&&' to prevent syntax errors.
        commands = (
            "sudo id -u agent1 >/dev/null 2>&1 || sudo useradd -ms /bin/bash agent1\n"
            "sudo mkdir -p /home/agent1/.vnc\n"
            "sudo cp -f /home/roberto/.vnc/passwd /home/agent1/.vnc/passwd\n"
            "sudo cp -f /home/roberto/.vnc/xstartup /home/agent1/.vnc/xstartup\n"
            "sudo chown -R agent1:agent1 /home/agent1/.vnc\n"
            "sudo chmod 600 /home/agent1/.vnc/passwd\n"
            "sudo chmod +x /home/agent1/.vnc/xstartup\n"
            
            # Kill stale processes
            "sudo killall -u agent1 Xvfb x11vnc websockify || true\n"
            "sudo rm -f /tmp/.X1-lock /tmp/.X11-unix/X1\n"
            
            # Launch background servers
            "sudo -u agent1 nohup Xvfb :1 -screen 0 1280x960x24 -ac -nolisten tcp >/dev/null 2>&1 &\n"
            "sleep 3\n"
            "sudo -u agent1 nohup dbus-launch --exit-with-session startxfce4 >/dev/null 2>&1 &\n"
            "sleep 5\n"
            "sudo -u agent1 nohup x11vnc -display :1 -N -forever -shared -rfbport 5901 -passwd iagencia >/dev/null 2>&1 &\n"
            "sleep 3\n"
            "sudo -u agent1 nohup websockify 6081 localhost:5901 >/dev/null 2>&1 &\n"
            "echo 'Agent1 environment started successfully on display :1!'\n"
        )
        
        stdin, stdout, stderr = ssh.exec_command(commands, timeout=60, get_pty=True)
        # Pass sudo password
        stdin.write("20011982.\n")
        stdin.flush()
        
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        print("Agent1 creation and environment startup complete!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
