"""Script de importacao de dados da pasta dados_entrada para o SQLite com desduplicacao inteligente."""

import pandas as pd
import math
import os
import glob
import uuid
import sqlite3

# Mapeamento de colunas Excel/CSV -> SQL
COLUMN_MAP = {
    "SS": "ss",
    "OS": "os_numero",
    "Tipo": "tipo",
    "Especificação": "especificacao",
    "Serviço": "servico",
    "Unid Atual (OS)": "unidade_os",
    "Matrícula": "matricula",
    "Logradouro": "logradouro",
    "CEP": "cep",
    "Núm do Imóvel": "cep",
    "Encerramento": "data_encerramento",
    "Conclusão da SS": "data_encerramento",
    "Obs da SS": "observacao",
    "Obs de Enc da OS": "observacao",
    "Sit da OS": "situacao",
    "Data/Hora Última Tramitação da OS": "data_ultima_tramitacao",
    "Dt Abertura da SS": "created_at",
    "Dt/Hr Abertura da SS": "created_at",
    "Localidade": "localidade",
    "Nome do Mês": "mes",
    "Setor": "setor",
    "Bairro": "bairro",
}

def get_db_connections():
    db_path = os.path.join(os.path.dirname(__file__), "saneaia.db")
    base_umb_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Base dados UMB", "base_umb.db")
    
    conns = [sqlite3.connect(db_path)]
    if os.path.exists(base_umb_path):
        conns.append(sqlite3.connect(base_umb_path))
    return conns

def import_file(file_path: str):
    """Importa dados de um arquivo Excel/CSV para o SQLite filtrando duplicidades por SS."""
    filename = os.path.basename(file_path)
    print(f"\n[FILE] Lendo arquivo: {filename}")
    
    try:
        if file_path.endswith('.csv'):
            try:
                df = pd.read_csv(file_path, sep=';', encoding='utf-8', on_bad_lines='skip')
            except Exception:
                df = pd.read_csv(file_path, sep=';', encoding='latin1', on_bad_lines='skip')
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        print(f"   [ERRO] Erro ao ler arquivo {filename}: {e}")
        return 0, 0, 0

    total_rows = len(df)
    print(f"   [INFO] Encontradas {total_rows} linhas x {len(df.columns)} colunas")

    df = df.rename(columns=COLUMN_MAP)

    if "ss" not in df.columns:
        print(f"   [AVISO] Coluna 'SS' nao encontrada no arquivo {filename}. Pulo.")
        return 0, 0, total_rows

    conns = get_db_connections()
    main_conn = conns[0]

    # Carregar conjunto de SSs ja existentes no banco
    existing_ss = set(r[0] for r in main_conn.execute("SELECT ss FROM solicitacoes WHERE ss IS NOT NULL AND ss != ''").fetchall())

    inserted_count = 0
    duplicate_count = 0

    # Obter lista de colunas reais da tabela solicitacoes
    table_cols = [c[1] for c in main_conn.execute("PRAGMA table_info(solicitacoes)").fetchall()]

    for _, row in df.iterrows():
        raw_ss = str(row.get("ss", "")).strip()
        if not raw_ss or raw_ss.lower() == "nan" or raw_ss.lower() == "none":
            continue

        if raw_ss in existing_ss:
            duplicate_count += 1
            # Atualização inteligente (UPSERT): Se a SS já existe no banco, atualiza TODOS os campos com os dados da extração mais recente!
            update_fields = {}
            for col in table_cols:
                if col in ["id", "ss"]: continue
                val = row.get(col)
                if not pd.isna(val) and val is not None and str(val).strip().lower() not in ["nan", "none"]:
                    update_fields[col] = str(val).strip()

            if update_fields:
                set_clause = ", ".join([f"{col} = ?" for col in update_fields.keys()])
                vals = list(update_fields.values()) + [raw_ss]
                sql = f"UPDATE solicitacoes SET {set_clause} WHERE ss = ? OR os_numero = ?"
                for c in conns:
                    c.execute(sql, vals + [raw_ss])
            continue

        # Novo registro unico!
        rec_id = str(uuid.uuid4())
        record = {"id": rec_id, "ss": raw_ss}

        for col in table_cols:
            if col in ["id", "ss"]: continue
            val = row.get(col)
            if pd.isna(val) or val is None or str(val).strip().lower() in ["nan", "none"]:
                record[col] = None
            else:
                record[col] = str(val).strip()

        # Inserir em todas as conexoes de DB
        cols_str = ",".join(record.keys())
        placeholders = ",".join(["?"] * len(record))
        sql = f"INSERT OR IGNORE INTO solicitacoes ({cols_str}) VALUES ({placeholders})"
        vals = list(record.values())

        for c in conns:
            c.execute(sql, vals)

        existing_ss.add(raw_ss)
        inserted_count += 1

    for c in conns:
        c.commit()
        c.close()

    print(f"   [OK] {inserted_count} novos registros inseridos.")
    print(f"   [INFO] {duplicate_count} duplicidades ignoradas.")
    return inserted_count, duplicate_count, total_rows

def process_all_in_folder():
    input_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dados_entrada")
    files = glob.glob(os.path.join(input_folder, "*.xlsx")) + glob.glob(os.path.join(input_folder, "*.csv"))
    
    if not files:
        print(f"Nenhum arquivo encontrado na pasta {input_folder}")
        return
        
    print("=" * 70)
    print("INICIANDO INGESTAO E ANALISE DE DUPLICIDADES (PROJETO 3)")
    print("=" * 70)

    total_inserted = 0
    total_dupes = 0
    total_read = 0

    for file_path in files:
        ins, dup, r = import_file(file_path)
        total_inserted += ins
        total_dupes += dup
        total_read += r

    print("\n" + "=" * 70)
    print("RESUMO FINAL DA INGESTAO NO PROJETO 3:")
    print(f"   - Total de Linhas Lidas nos CSVs: {total_read}")
    print(f"   - Registros Duplicados Descartados: {total_dupes}")
    print(f"   - Novos Registros Unicos Inseridos: {total_inserted}")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    process_all_in_folder()

