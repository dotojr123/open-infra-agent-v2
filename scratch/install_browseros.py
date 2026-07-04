import paramiko

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # 1. Make the AppImage executable
        # 2. Create the Desktop directory if it doesn't exist
        # 3. Write the browseros.desktop entry
        # 4. Make the desktop entry executable
        commands = [
            "chmod +x /home/roberto/Downloads/BrowserOS.AppImage",
            "mkdir -p /home/roberto/Desktop",
            """echo '[Desktop Entry]
Version=1.0
Type=Application
Name=BrowserOS
Comment=BrowserOS Client
Exec=/home/roberto/Downloads/BrowserOS.AppImage --no-sandbox
Icon=web-browser
Terminal=false
Categories=Network;WebBrowser;' > /home/roberto/Desktop/browseros.desktop""",
            "chmod +x /home/roberto/Desktop/browseros.desktop"
        ]
        
        cmd_chain = " && ".join(commands)
        stdin, stdout, stderr = ssh.exec_command(cmd_chain, timeout=30)
        
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        print("BrowserOS desktop integration completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
