"""
Script de importação automática de CSVs para o dashboard.

Uso:
  1. Coloque este arquivo na mesma pasta que os CSVs
  2. Execute: python importar.py

Requisito: pip install requests
"""

import requests
import sys
import os

URL = "https://bsqlbcybwidmdysuoowu.supabase.co/functions/v1/import-csv"

arquivos = [
    ("waterShortage", "faltadagua.csv"),
    ("pavement",      "pavimento.csv"),
    ("leaks",         "vazamentos.csv"),
    ("waterTruck",    "carropipa.csv"),
]

def importar(tipo, caminho_csv):
    if not os.path.exists(caminho_csv):
        print(f"  ⚠️  Arquivo não encontrado: {caminho_csv} — pulando.")
        return

    print(f"  Enviando {caminho_csv}...", end=" ", flush=True)
    with open(caminho_csv, "rb") as f:
        response = requests.post(
            URL,
            data={"type": tipo},
            files={"file": (caminho_csv, f, "text/csv")},
            timeout=120,  # 2 minutos
        )

    try:
        resultado = response.json()
    except Exception:
        print(f"ERRO — resposta inesperada: {response.text}")
        return

    if response.ok and resultado.get("success"):
        print(f"✅  {resultado['count']} registros importados.")
    else:
        print(f"❌  Falha: {resultado.get('error', 'erro desconhecido')}")

if __name__ == "__main__":
    print("=" * 50)
    print("Importação de CSVs — Dashboard")
    print("=" * 50)

    for tipo, arquivo in arquivos:
        importar(tipo, arquivo)

    print("=" * 50)
    print("Concluído.")
