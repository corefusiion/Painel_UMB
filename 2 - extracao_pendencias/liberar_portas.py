# -*- coding: utf-8 -*-
"""
Script utilitário para liberar as portas do ecossistema UMBMAS:
- 3001: GestaoUMB Backend (Express)
- 8080: GestaoUMB Frontend (Vite)
- 8000: SaneaIA Backend (FastAPI)
- 3002: Webhook Recebimento (Python)

Finaliza processos residuais ou zumbis para evitar erros de soquete
como WinError 10048 ou EADDRINUSE.
"""

import os
import sys
import subprocess

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

TARGET_PORTS = [3001, 8080, 8000, 3002]

def free_ports():
    my_pid = os.getpid()
    pids_found = set()

    try:
        # Obter conexões ativas via netstat
        output = subprocess.check_output(
            "netstat -ano",
            shell=True,
            text=True,
            errors="ignore"
        )
    except Exception as e:
        print(f"[!] Erro ao executar netstat: {e}")
        return

    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        # Exemplo TCP: TCP 0.0.0.0:8000 0.0.0.0:0 LISTENING 120016
        if len(parts) >= 5 and parts[0].upper() == "TCP":
            local_addr = parts[1]
            state = parts[3]
            pid_str = parts[4]

            if state.upper() == "LISTENING":
                for port in TARGET_PORTS:
                    # Checa :8000 no final da string local_addr (ex: 0.0.0.0:8000 ou 127.0.0.1:8000 ou [::]:8000)
                    if local_addr.endswith(f":{port}"):
                        try:
                            pid = int(pid_str)
                            if pid != my_pid and pid != 0:
                                pids_found.add((port, pid))
                        except ValueError:
                            pass

    if not pids_found:
        print("[OK] Nenhuma porta (3001, 8080, 8000, 3002) ocupada. Sistema pronto para inicializacao.")
        return

    print(f"[*] Encontrados {len(pids_found)} processos ocupando as portas...")
    for port, pid in sorted(pids_found):
        print(f"[!] Liberando porta {port} (finalizando PID {pid})...")
        try:
            subprocess.run(
                f"taskkill /F /PID {pid}",
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            pass

    print("[OK] Portas do ecossistema liberadas com sucesso!")

if __name__ == "__main__":
    free_ports()
