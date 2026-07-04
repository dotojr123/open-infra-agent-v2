import sys
import paramiko

def main():
    if len(sys.argv) < 2:
        print("Usage: python ssh_run.py <command>")
        sys.exit(1)
    cmd = " ".join(sys.argv[1:])
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=15)
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8', errors='ignore'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8', errors='ignore'))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
