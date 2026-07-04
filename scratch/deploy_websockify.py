import time
import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # Kill any active websockify
        print("Stopping existing websockify processes...")
        stdin, stdout, stderr = ssh.exec_command("sudo pkill -f websockify || true", timeout=15, get_pty=True)
        stdin.write("20011982.\n")
        stdin.flush()
        stdout.read() # Wait for command to complete
        time.sleep(2)
        
        # Deploy start_websockify.py via SFTP
        print("Deploying start_websockify.py to VM...")
        sftp = ssh.open_sftp()
        script_content = (
            "import subprocess\n"
            "import os\n"
            "\n"
            "# Start roberto websockify\n"
            "subprocess.Popen(\n"
            "    ['websockify', '--web=/usr/share/novnc/', '6080', 'localhost:5900'],\n"
            "    stdout=open('/home/roberto/websockify_6080.log', 'w'),\n"
            "    stderr=subprocess.STDOUT,\n"
            "    start_new_session=True\n"
            ")\n"
            "\n"
            "# Start agent1 websockify\n"
            "subprocess.Popen(\n"
            "    ['sudo', '-u', 'agent1', 'websockify', '--web=/usr/share/novnc/', '6081', 'localhost:5901'],\n"
            "    stdout=open('/home/roberto/websockify_6081.log', 'w'),\n"
            "    stderr=subprocess.STDOUT,\n"
            "    start_new_session=True\n"
            ")\n"
            "print('Websockify processes launched in detached mode!')\n"
        )
        
        with sftp.file("/home/roberto/start_websockify.py", "w") as f:
            f.write(script_content)
        sftp.close()
        
        # Execute the python script as root (so it can spawn as agent1 without prompting)
        print("Executing start_websockify.py as root...")
        stdin, stdout, stderr = ssh.exec_command("sudo python3 /home/roberto/start_websockify.py", timeout=30, get_pty=True)
        stdin.write("20011982.\n")
        stdin.flush()
        
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        print("Websockify configuration and detached startup completed!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
