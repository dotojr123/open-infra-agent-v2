import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # Write xstartup via SFTP
        sftp = ssh.open_sftp()
        xstartup_content = (
            "#!/bin/sh\n"
            "[ -r $HOME/.Xresources ] && xrdb $HOME/.Xresources\n"
            "xsetroot -solid grey\n"
            "openbox-session &\n"
            "xterm -geometry 120x40+10+10 -ls -title \"Terminal\" &\n"
        )
        
        with sftp.file("/home/roberto/.vnc/xstartup", "w") as f:
            f.write(xstartup_content)
            
        print("xstartup file deployed successfully via SFTP!")
        sftp.close()
        
        # Make xstartup executable and restart vncserver
        commands = [
            "chmod +x ~/.vnc/xstartup",
            "vncserver -kill :1 || true",
            "vncserver :1 -geometry 1280x720 -depth 24"
        ]
        cmd_chain = " && ".join(commands)
        
        stdin, stdout, stderr = ssh.exec_command(cmd_chain, timeout=30)
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
