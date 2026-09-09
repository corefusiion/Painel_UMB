import sqlite3
import os

source_db = r"C:\Users\t034183\Desktop\UMBMAS\3 - Saneaia\Base dados UMB\base_umb.db"
target_db = r"C:\Users\t034183\Desktop\UMBMAS\3 - Saneaia\database\saneaia.db"

def migrate():
    print("Iniciando migração de dados do backup massivo...")
    
    if not os.path.exists(source_db):
        print(f"Arquivo não encontrado: {source_db}")
        return
        
    conn_src = sqlite3.connect(source_db)
    conn_tgt = sqlite3.connect(target_db)
    conn_src.row_factory = sqlite3.Row

    cursor_src = conn_src.cursor()
    cursor_tgt = conn_tgt.cursor()

    # Puxar dados do SQLite de backup (tabela public__solicitacoes)
    cursor_src.execute("SELECT * FROM public__solicitacoes")
    rows = cursor_src.fetchall()

    print(f"Lidos {len(rows)} registros. Inserindo no banco Saneaia...")

    insert_sql = """
    INSERT INTO solicitacoes (
        ss, os_numero, tipo, especificacao, servico, unidade_os, matricula, 
        setor, bairro, logradouro, cep, data_encerramento, observacao, 
        situacao, data_ultima_tramitacao, mes, localidade, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    # Limpar a tabela antes de preencher para evitar duplicidades caso rode duas vezes
    cursor_tgt.execute("DELETE FROM solicitacoes")

    count = 0
    for r in rows:
        cursor_tgt.execute(insert_sql, (
            r['ss'], r['os_numero'], r['tipo'], r['especificacao'], r['servico'], 
            r['unidade_os'], r['matricula'], r['setor'], r['bairro'], r['logradouro'], 
            r['cep'], r['data_encerramento'], r['observacao'], r['situacao'], 
            r['data_ultima_tramitacao'], r['mes'], r['localidade'], r['created_at'] if 'created_at' in r.keys() else None
        ))
        count += 1
        if count % 10000 == 0:
            print(f"{count} inseridos...")

    conn_tgt.commit()
    conn_tgt.close()
    conn_src.close()
    print(f"Migração concluída com sucesso! Total de {count} registros gravados.")

if __name__ == '__main__':
    migrate()
