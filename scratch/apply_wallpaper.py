import os
import paramiko

def main():
    local_path = r"C:\Users\Doto\.gemini\antigravity-ide\brain\4dc62d22-9c8e-4f22-bd2a-21f23d2c5f61\open_infra_wallpaper_1783137351825.png"
    remote_dir = "/home/roberto/Pictures"
    remote_path = remote_dir + "/open_infra_wallpaper.png"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect("192.168.159.128", username="roberto", password="20011982.", timeout=30)
        
        # 1. Create remote Pictures folder
        sftp = ssh.open_sftp()
        try:
            sftp.mkdir(remote_dir)
        except IOError:
            pass # already exists
            
        # 2. Upload file via SFTP
        print("Uploading wallpaper image to VM...")
        sftp.put(local_path, remote_path)
        sftp.close()
        print("Upload complete!")
        
        # 3. Apply wallpaper using xfconf-query
        print("Applying wallpaper to XFCE desktop...")
        commands = [
            f"DISPLAY=:0 xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitorscreen/workspace0/last-image -s {remote_path}",
            f"DISPLAY=:0 xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitorscreen/workspace1/last-image -s {remote_path}",
            f"DISPLAY=:0 xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitorscreen/workspace2/last-image -s {remote_path}",
            f"DISPLAY=:0 xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitorscreen/workspace3/last-image -s {remote_path}"
        ]
        
        stdin, stdout, stderr = ssh.exec_command(" && ".join(commands), timeout=15)
        print("--- STDOUT ---")
        print(stdout.read().decode('utf-8'))
        print("--- STDERR ---")
        print(stderr.read().decode('utf-8'))
        print("Wallpaper applied successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
