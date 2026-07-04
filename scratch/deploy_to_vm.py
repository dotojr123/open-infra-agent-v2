#!/usr/bin/env python3
"""Deploy IAgencia to VM via SFTP"""
import paramiko
import sys
import os

HOST = "192.168.159.128"
USER = "roberto"
PASSWORD = "20011982."
PORT = 22

def main():
    print(f"Connecting to {HOST}:{PORT}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(HOST, username=USER, password=PASSWORD, port=PORT, timeout=30)
        print("Connected!")

        # Check if archive exists
        local_archive = r"C:\Users\Doto\Desktop\PROJETOS-2026\open-infro-agentc-v04\tmp\iagenciad-deploy.tar.gz"
        if not os.path.exists(local_archive):
            local_archive = r"/tmp/iagenciad-deploy.tar.gz"

        if not os.path.exists(local_archive):
            print(f"Archive not found at {local_archive}")
            return

        # SFTP upload
        sftp = ssh.open_sftp()
        remote_path = f"/home/{USER}/iagenciad-deploy.tar.gz"
        print(f"Uploading {local_archive} -> {remote_path}...")
        sftp.put(local_archive, remote_path)
        sftp.close()
        print("Upload complete!")

        # Extract on remote
        print("Extracting archive...")
        stdin, stdout, stderr = ssh.exec_command(
            f"cd /home/{USER} && tar -xzf iagenciad-deploy.tar.gz && ls -la"
        )
        output = stdout.read().decode()
        print(output)

        # Install dependencies
        print("Installing dependencies...")
        stdin, stdout, stderr = ssh.exec_command(
            f"cd /home/{USER}/iagenciad && npm install 2>&1 | tail -20"
        )
        output = stdout.read().decode()
        print(output)

        # Build
        print("Building project...")
        stdin, stdout, stderr = ssh.exec_command(
            f"cd /home/{USER}/iagenciad && npm run build 2>&1 | tail -30"
        )
        output = stdout.read().decode()
        print(output)

        # Start daemon
        print("Starting IAgencia daemon...")
        stdin, stdout, stderr = ssh.exec_command(
            f"cd /home/{USER}/iagenciad && nohup npm run start:prod > /tmp/iagencia.log 2>&1 &"
        )

        print("Deployment complete!")
        print("\nAccess the API at: http://192.168.159.128:9990/health")
        print("VNC Sessions API: http://192.168.159.128:9990/vnc-sessions")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()