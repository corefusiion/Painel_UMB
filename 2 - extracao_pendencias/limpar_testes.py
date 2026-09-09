# -*- coding: utf-8 -*-
"""
Script utilitário blindado para expurgar todos os registros de teste e homologação
dos bancos de dados do ecossistema UMBMAS:
- Projeto 1 (1 - gestoaumb/database.sqlite)
- Projeto 3 (3 - Saneaia/database/saneaia.db)

Blindagem de segurança:
1. Schema-aware: Inspeciona as colunas dinamicamente para evitar erros de sintaxe em tabelas sem 'observacao' (ex: vazamentos e pavimentos).
2. Parametrização estrita: Consultas 100% parametrizadas (zero SQL Injection).
3. Rastreamento por tracker: Consulta a tabela 'webhook_test_tracker' populada pelo gateway.
"""

import os
import sys
import sqlite3

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PROJETO_1 = os.path.join(BASE_DIR, "1 - gestoaumb", "database.sqlite")
DB_PROJETO_3 = os.path.join(BASE_DIR, "3 - Saneaia", "database", "saneaia.db")

KNOWN_TEST_SS = [
    '960012345', '959979459', '960000001', '960000002', '960098765', 
    '9999999999', '9999999998', '9999999901'
]

def purge_all():
    print("\n" + "=" * 65)
    print("      ROTINA DE EXPURGO DE DADOS DE TESTE / HOMOLOGAÇÃO")
    print("=" * 65)

    del_saneaia = 0
    del_gestao = 0

    # 1. Limpeza no Projeto 3 (saneaia.db)
    if os.path.exists(DB_PROJETO_3):
        try:
            conn = sqlite3.connect(DB_PROJETO_3)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
            cur.execute("SELECT ss FROM webhook_test_tracker")
            tracker_ss = [r[0] for r in cur.fetchall()]

            all_test_ss = list(set(KNOWN_TEST_SS + tracker_ss))
            ph = ",".join("?" for _ in all_test_ss)

            sql_saneaia = f"""
                DELETE FROM solicitacoes 
                WHERE ss IN ({ph})
                   OR os_numero IN ({ph})
                   OR observacao LIKE '%[TESTE%'
                   OR observacao LIKE '%TESTE_EMULADOR%'
                   OR especificacao LIKE '%[TESTE%'
                   OR ss LIKE '999999%'
            """
            cur.execute(sql_saneaia, all_test_ss + all_test_ss)
            del_saneaia = cur.rowcount
            cur.execute("DELETE FROM webhook_test_tracker")
            conn.commit()
            conn.close()
            print(f"[OK] Projeto 3 (saneaia.db -> solicitacoes): {del_saneaia} registros removidos.")
        except Exception as e:
            print(f"[ERRO] Falha no saneaia.db: {e}")
    else:
        print(f"[AVISO] saneaia.db não encontrado em {DB_PROJETO_3}")

    # 2. Limpeza no Projeto 1 (database.sqlite)
    if os.path.exists(DB_PROJETO_1):
        try:
            conn = sqlite3.connect(DB_PROJETO_1)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
            cur.execute("SELECT ss FROM webhook_test_tracker")
            tracker_ss_gestao = [r[0] for r in cur.fetchall()]

            all_test_ss = list(set(KNOWN_TEST_SS + tracker_ss_gestao))
            ph = ",".join("?" for _ in all_test_ss)

            tables = ['faltadagua', 'faltadagua_ex', 'vazamentos', 'pavimentos', 'carropipa', 'ai_insights_faltadagua']
            for tbl in tables:
                cur.execute(f"PRAGMA table_info({tbl})")
                cols = [c[1] for c in cur.fetchall()]
                if not cols:
                    continue

                id_col = 'numero_os' if 'numero_os' in cols else ('ss' if 'ss' in cols else None)
                if not id_col:
                    continue

                conds = [f"{id_col} IN ({ph})", f"{id_col} LIKE '999999%'"]
                params = list(all_test_ss)

                if 'observacao' in cols:
                    conds.append("observacao LIKE '%[TESTE%'")
                    conds.append("observacao LIKE '%TESTE_EMULADOR%'")
                if 'especificacao' in cols:
                    conds.append("especificacao LIKE '%[TESTE%'")
                    conds.append("especificacao LIKE '%TESTE_EMULADOR%'")

                query = f"DELETE FROM {tbl} WHERE " + " OR ".join(conds)
                cur.execute(query, params)
                if cur.rowcount > 0:
                    print(f"[OK] Projeto 1 (database.sqlite -> {tbl}): {cur.rowcount} registros removidos.")
                    del_gestao += cur.rowcount

            cur.execute("DELETE FROM webhook_test_tracker")
            conn.commit()
            conn.close()
            print(f"[OK] Projeto 1 (database.sqlite total): {del_gestao} registros removidos.")
        except Exception as e:
            print(f"[ERRO] Falha no database.sqlite: {e}")
    else:
        print(f"[AVISO] database.sqlite não encontrado em {DB_PROJETO_1}")

    print("=" * 65)
    print(f"Limpeza concluída com sucesso! Total geral removido: {del_saneaia + del_gestao} registros.")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    purge_all()
