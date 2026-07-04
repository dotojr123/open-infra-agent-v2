import sys
import traceback
import paramiko

def main():
    if len(sys.argv) < 2:
        print("Usage: python ssh_exec.py <command>")
        sys.exit(1)
        
    cmd = " ".join(sys.argv[1:])
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        print("Connecting to 192.168.159.128 on port 22...")
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=60, banner_timeout=60)
        print("Connected! Executing command...")
        
        # We request a pseudo-terminal (get_pty=True) which makes sudo prompt for password in a standard way
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60, get_pty=True)
        
        # Write the password immediately in case of sudo prompt
        stdin.write("20011982.\n")
        stdin.flush()
        
        print("--- STDOUT ---")
        # Reading line-by-line to print real-time and prevent hanging
        for line in stdout:
            print(line, end="")
        print("\n--- STDERR ---")
        for line in stderr:
            print(line, end="")
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
