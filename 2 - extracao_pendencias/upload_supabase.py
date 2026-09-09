# -*- coding: utf-8 -*-
"""
Envia CSVs extraídos para o Supabase via Edge Function.
A Edge Function (criada pelo Lovable) cuida de toda a tratativa:
  - Detectar separador, encoding
  - Formatar bairro, logradouro (title case, remover código)
  - Converter datas DD/MM/YYYY → ISO
  - Detectar tipo (vazamento/pavimento), responsável (CNB/Embasa)
  - Limpar CEP, truncar observação
  - Deletar dados do dia antes de inserir
  - Inserir em lotes de 100

Nosso script apenas envia os arquivos CSV brutos com o tipo correto.
Após envio bem-sucedido, limpa os CSVs da pasta.
"""

import requests
import os
import glob
from datetime import datetime

# URL da Edge Function no Supabase (MANTIDO COMENTADO PARA USO FUTURO)
# EDGE_FUNCTION_URL = "https://bsqlbcybwidmdysuoowu.supabase.co/functions/v1/import-csv"

# URL da nossa nova API Local (Express + SQLite)
LOCAL_API_URL = "http://127.0.0.1:3001/api/import-csv"

# Base dir dos dados (mesmos caminhos de pastas_mapeadas em funcoes.py)
DADOS_DIR = os.path.join(os.path.dirname(__file__), "dados")

# Mapeamento: pasta local → tipo esperado pela API
FOLDER_TYPE_MAP = {
    "Vazamento":   "leaks",
    "Pavimento":   "pavement",
    "Falta_dagua": "waterShortage",
    "Carro_pipa":  "waterTruck",
    "Falta_dagua_ex": "waterShortageEx",
}


def upload_folder(folder_name, tipo):
    """
    Envia todos os CSVs de uma pasta para a API Local.
    Retorna (enviados_com_sucesso, erros, lista_arquivos_ok).
    """
    folder_path = os.path.join(DADOS_DIR, folder_name)
    csv_files = glob.glob(os.path.join(folder_path, "*.csv"))
    
    if not csv_files:
        print(f"  Nenhum CSV encontrado em {folder_name}/")
        return 0, 0, []
    
    total_ok = 0
    total_err = 0
    arquivos_ok = []
    
    for csv_file in csv_files:
        filename = os.path.basename(csv_file)
        try:
            with open(csv_file, "rb") as f:
                # ==========================================
                # CÓDIGO SUPABASE (COMENTADO PARA FUTURO)
                # ==========================================
                # resp = requests.post(
                #     EDGE_FUNCTION_URL,
                #     data={"type": tipo},
                #     files={"file": (filename, f, "text/csv")},
                #     timeout=60
                # )
                
                # ==========================================
                # NOVO CÓDIGO (LOCAL EXPRESS + SQLITE)
                # ==========================================
                resp = requests.post(
                    LOCAL_API_URL,
                    data={"type": tipo},
                    files={"file": (filename, f, "text/csv")},
                    timeout=60
                )
            
            if resp.status_code == 200:
                result = resp.json()
                count = result.get("count", "?")
                print(f"  [OK] {filename}: {count} registros importados localmente")
                total_ok += 1
                arquivos_ok.append(csv_file)
            else:
                print(f"  [ERRO] {filename}: HTTP {resp.status_code}")
                print(f"    {resp.text[:200]}")
                total_err += 1
        except Exception as e:
            print(f"  [ERRO] {filename}: Erro na requisição: {e}")
            total_err += 1
    
    return total_ok, total_err, arquivos_ok


def limpar_csvs(arquivos):
    """Remove CSVs que já foram enviados com sucesso ao Supabase."""
    removidos = 0
    for csv_file in arquivos:
        try:
            os.remove(csv_file)
            removidos += 1
        except Exception as e:
            print(f"  ⚠ Não foi possível remover {os.path.basename(csv_file)}: {e}")
    if removidos:
        print(f"  [LIXEIRA] {removidos} CSV(s) removido(s) após envio bem-sucedido")
    return removidos


def upload_all():
    """Envia CSVs de todas as 3 pastas para o Supabase via Edge Function."""
    print("=" * 60)
    print("UPLOAD PARA SUPABASE — via Edge Function")
    print(f"Início: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 60)
    
    total_ok = 0
    total_err = 0
    todos_arquivos_ok = []
    
    for folder_name, tipo in FOLDER_TYPE_MAP.items():
        print(f"\n[UPLOAD] {folder_name} -> tipo '{tipo}'")
        ok, err, arquivos_ok = upload_folder(folder_name, tipo)
        total_ok += ok
        total_err += err
        todos_arquivos_ok.extend(arquivos_ok)
    
    # Limpar CSVs enviados com sucesso
    if todos_arquivos_ok:
        print(f"\n[LIMPEZA] Removendo CSVs já enviados...")
        limpar_csvs(todos_arquivos_ok)
    
    print(f"\n{'='*60}")
    print(f"UPLOAD CONCLUÍDO")
    print(f"Arquivos enviados: {total_ok}")
    print(f"Erros: {total_err}")
    print(f"Fim: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*60}")
    
    return total_ok, total_err


def upload_executadas_only():
    """Envia apenas os CSVs de Executadas e limpa após o envio."""
    print("=" * 60)
    print("UPLOAD DE EXECUTADAS PARA O PAINEL (Projeto 1)")
    print("=" * 60)
    
    ok, err, arquivos_ok = upload_folder("Falta_dagua_ex", "waterShortageEx")
    
    if arquivos_ok:
        print(f"\n[LIMPEZA] Removendo CSVs de executadas enviados...")
        limpar_csvs(arquivos_ok)
        
    print(f"\nUpload concluído: {ok} enviados, {err} erros.")
    return ok, err



if __name__ == "__main__":
    upload_all()
