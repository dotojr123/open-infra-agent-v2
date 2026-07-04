import sys
import paramiko

def main():
    if len(sys.argv) < 2:
        print("Usage: python ssh_sudo_run.py <command>")
        sys.exit(1)
    cmd = " ".join(sys.argv[1:])
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        # request a pty for sudo interactive password prompt
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300, get_pty=True)
        # write sudo password
        stdin.write("20011982.\n")
        stdin.flush()
        
        print("--- OUTPUT ---")
        for line in stdout:
            print(line, end="")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
