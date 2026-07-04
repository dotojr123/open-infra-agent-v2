import subprocess
import re

def run_cmd(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return ""

def main():
    print("==================================================")
    print(" 🚀 iAgência - Mapeamento de Infraestrutura (VNC)")
    print("==================================================")
    
    # Busca por processos x11vnc
    vnc_out = run_cmd("ps aux | grep -i x11vnc | grep -v grep")
    websockify_out = run_cmd("ps aux | grep -i websockify | grep -v grep")
    
    displays = {}
    
    # Processa VNCs
    for line in vnc_out.strip().split('\n'):
        if not line: continue
        parts = line.split(maxsplit=10)
        if len(parts) >= 11:
            user = parts[0]
            cmd = parts[10]
            
            # Extrai porta VNC
            port_match = re.search(r'-rfbport\s+(\d+)', cmd)
            vnc_port = port_match.group(1) if port_match else "N/A"
            
            # Extrai display
            disp_match = re.search(r'-display\s+(:[0-9]+)', cmd)
            display = disp_match.group(1) if disp_match else "N/A"
            
            if display not in displays:
                displays[display] = {"user": user, "vnc_port": vnc_port, "web_port": "N/A", "status": "Ativo"}

    # Processa Websockify (para achar a porta Web)
    for line in websockify_out.strip().split('\n'):
        if not line: continue
        parts = line.split(maxsplit=10)
        if len(parts) >= 11:
            cmd = parts[10]
            
            # Tenta casar "6080 localhost:5900"
            match = re.search(r'(\d+)\s+localhost:(\d+)', cmd)
            if match:
                web_port = match.group(1)
                target_vnc = match.group(2)
                
                for disp, data in displays.items():
                    if data["vnc_port"] == target_vnc:
                        data["web_port"] = web_port

    if not displays:
        print("\nNenhum ambiente VNC detectado em execução.")
        return

    print(f"\n✅ {len(displays)} Ambientes Isolados Detectados:\n")
    
    for disp, data in displays.items():
        print(f"🔹 Display: {disp}")
        print(f"   👤 Usuário: {data['user']}")
        print(f"   🔌 Porta VNC (Interna): {data['vnc_port']}")
        print(f"   🌐 Porta Web (noVNC): {data['web_port']}")
        print(f"   🔗 Link Local: http://localhost:{data['web_port']}/vnc.html")
        print("-" * 50)
        
if __name__ == "__main__":
    main()
