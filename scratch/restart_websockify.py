import time
import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # Kill all running websockify processes with force SIGKILL
        print("Stopping existing websockify processes...")
        commands_kill = "sudo killall -9 websockify || true\n"
        ssh.exec_command(commands_kill, timeout=15)
        time.sleep(2)
        
        # Start websockify with --web parameter for both roberto and agent1
        commands_start = (
            "nohup websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/dev/null 2>&1 &\n"
            "sudo -u agent1 nohup websockify --web=/usr/share/novnc/ 6081 localhost:5901 >/dev/null 2>&1 &\n"
            "echo 'Websockify servers restarted with --web support!'\n"
        )
        
        print("Restarting websockify servers...")
        stdin, stdout, stderr = ssh.exec_command(commands_start, timeout=30, get_pty=True)
        stdin.write("20011982.\n")
        stdin.flush()
        
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        print("Websockify configuration updated successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
