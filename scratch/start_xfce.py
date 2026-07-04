import time
import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # Kill previous VNC, websockify, and Xvfb
        print("Cleaning up old display servers...")
        cleanup_cmds = [
            "vncserver -kill :1 || true",
            "killall Xvfb x11vnc websockify || true",
            "sudo killall -9 Xvfb x11vnc websockify || true",
            "rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 || true"
        ]
        ssh.exec_command(" && ".join(cleanup_cmds), timeout=15)
        time.sleep(2)
        
        # Deploy start_xfce.sh script via SFTP
        print("Deploying start_xfce.sh script...")
        sftp = ssh.open_sftp()
        script_content = (
            "#!/bin/bash\n"
            "export DISPLAY=:0\n"
            "Xvfb :0 -screen 0 1280x960x24 -ac -nolisten tcp &\n"
            "sleep 3\n"
            "dbus-launch --exit-with-session startxfce4 &\n"
            "sleep 5\n"
            "x11vnc -display :0 -N -forever -shared -rfbport 5900 &\n"
            "sleep 3\n"
            "nohup websockify 6080 localhost:5900 >/dev/null 2>&1 &\n"
            "echo \"XFCE and noVNC startup triggered!\"\n"
        )
        
        with sftp.file("/home/roberto/start_xfce.sh", "w") as f:
            f.write(script_content)
        sftp.close()
        
        # Make script executable and run it
        print("Starting XFCE Desktop Environment on VM...")
        stdin, stdout, stderr = ssh.exec_command("chmod +x ~/start_xfce.sh && ~/start_xfce.sh", timeout=30)
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
