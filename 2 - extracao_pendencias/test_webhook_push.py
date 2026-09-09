# -*- coding: utf-8 -*-
"""
Script de Teste de Validação de Recebimento via Webhook da Embasa (TI)
======================================================================
Este script simula o envio de uma Solicitação de Serviço (SS) completa
pelo setor de TI da Embasa para o Webhook (porta 3002).

Etapas do teste:
1. Valida se o Webhook está online (GET /status).
2. Envia um payload JSON com uma SS completa de teste (POST /webhook).
3. Verifica se a SS foi gravada no banco do Projeto 3 (saneaia.db -> tabela solicitacoes).
4. Verifica se a SS foi classificada e persistida no banco do Projeto 1 (database.sqlite -> tabela faltadagua_ex).
5. Limpa (deleta) a SS de teste de ambos os bancos para não poluir os dados reais.
6. Confirma que a exclusão foi realizada com sucesso.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime

# Configuração de encoding para Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

WEBHOOK_URL = "http://localhost:3002/webhook"
STATUS_URL = "http://localhost:3002/status"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PROJETO_1 = os.path.join(BASE_DIR, "1 - gestoaumb", "database.sqlite")
DB_PROJETO_3 = os.path.join(BASE_DIR, "3 - Saneaia", "database", "saneaia.db")

# Número único e inconfundível para o teste
TEST_SS_NUMBER = "9999999999"

# Modelo completo de uma Solicitação de Serviço (SS)
PAYLOAD_TESTE = {
    "ss": TEST_SS_NUMBER,
    "servico": "364 - VERIF FALTA AGUA IMOVEL",
    "matricula": "88888888",
    "localidade": "LAURO DE FREITAS",
    "bairro": "10 - CENTRO",
    "logradouro": "RUA TESTE INTEGRACAO TI EMBASA",
    "num_imovel": "999",
    "data_abertura": "09/09/2026 08:00:00",
    "data_conclusao": "09/09/2026 08:30:00",
    "especificacao": "FALTA DE AGUA GERAL NO IMOVEL",
    "observacao": "TESTE DE VALIDACAO TI EMBASA: MANOBRA EFETUADA E PRESSAO RESTABELECIDA 12 MCA",
    "situacao": "Concluída Executada",
    "unidade_atual": "UMBMAS",
    "data_tramitacao": "09/09/2026 08:35:00"
}

def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def step_1_check_webhook():
    print("\n[PASSO 1] Verificando se o Webhook Receiver está online...")
    try:
        req = urllib.request.Request(STATUS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                print(f"  [OK] Webhook ativo e respondendo na porta {data.get('porta', 3002)}!")
                print(f"       Serviço: {data.get('service')} | Status: {data.get('status')}")
                return True
            else:
                print(f"  [ERRO] Webhook respondeu com status inesperado: {response.status}")
                return False
    except Exception as e:
        print(f"  [ERRO] Não foi possível conectar ao Webhook em {STATUS_URL}: {e}")
        print("         Certifique-se de que 'python listener_recebimento.py' está em execução.")
        return False

def step_2_send_payload():
    print(f"\n[PASSO 2] Enviando payload da SS de Teste ({TEST_SS_NUMBER}) via POST para {WEBHOOK_URL}...")
    try:
        data_bytes = json.dumps([PAYLOAD_TESTE], ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data_bytes,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "Embasa-TI-Integration-Tester/1.0"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.status
            body = response.read().decode('utf-8')
            res_json = json.loads(body)
            print(f"  [OK] Resposta HTTP recebida: Status {status}")
            print(f"       Mensagem: {res_json.get('message')}")
            print(f"       Classificações salvas: {res_json.get('classificacoes_salvas')}")
            print(f"       Sucesso reportado: {res_json.get('sucesso')}")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        print(f"  [ERRO HTTP {e.code}] Falha no envio: {error_body}")
        return False
    except Exception as e:
        print(f"  [ERRO] Falha de conexão ao enviar dados: {e}")
        return False

def step_3_verify_database_saneaia():
    print(f"\n[PASSO 3] Verificando persistência no Projeto 3 (saneaia.db)...")
    if not os.path.exists(DB_PROJETO_3):
        print(f"  [ERRO] Banco saneaia.db não encontrado em: {DB_PROJETO_3}")
        return False

    try:
        conn = sqlite3.connect(DB_PROJETO_3)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT ss, servico, matricula, logradouro, bairro, situacao, observacao FROM solicitacoes WHERE ss = ?", (TEST_SS_NUMBER,))
        row = c.fetchone()
        conn.close()

        if row:
            print(f"  [OK] Registro encontrado em 'saneaia.db' -> tabela 'solicitacoes'!")
            print(f"       SS: {row['ss']}")
            print(f"       Serviço: {row['servico']}")
            print(f"       Matrícula: {row['matricula']}")
            print(f"       Logradouro: {row['logradouro']} ({row['bairro']})")
            print(f"       Situação: {row['situacao']}")
            print(f"       Observação: {row['observacao'][:65]}...")
            return True
        else:
            print(f"  [ERRO] Registro {TEST_SS_NUMBER} NÃO foi encontrado na tabela solicitacoes de saneaia.db!")
            return False
    except Exception as e:
        print(f"  [ERRO] Falha ao consultar saneaia.db: {e}")
        return False

def step_4_verify_database_gestao():
    print(f"\n[PASSO 4] Verificando persistência no Projeto 1 (database.sqlite)...")
    if not os.path.exists(DB_PROJETO_1):
        print(f"  [ERRO] Banco database.sqlite não encontrado em: {DB_PROJETO_1}")
        return False

    try:
        conn = sqlite3.connect(DB_PROJETO_1)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT numero_os, servico, matricula, logradouro, bairro_codigo, unidade_atual, observacao FROM faltadagua_ex WHERE numero_os = ?", (TEST_SS_NUMBER,))
        row = c.fetchone()
        conn.close()

        if row:
            print(f"  [OK] Registro encontrado em 'database.sqlite' -> tabela 'faltadagua_ex'!")
            print(f"       Número OS: {row['numero_os']}")
            print(f"       Serviço: {row['servico']}")
            print(f"       Matrícula: {row['matricula']}")
            print(f"       Logradouro: {row['logradouro']}")
            print(f"       Unidade / Status: {row['unidade_atual']}")
            print(f"       Observação: {row['observacao'][:65]}...")
            return True
        else:
            print(f"  [ERRO] Registro {TEST_SS_NUMBER} NÃO foi encontrado na tabela faltadagua_ex de database.sqlite!")
            return False
    except Exception as e:
        print(f"  [ERRO] Falha ao consultar database.sqlite: {e}")
        return False

def step_5_cleanup():
    print(f"\n[PASSO 5] Excluindo registro de teste ({TEST_SS_NUMBER}) para manter os bancos 100% limpos...")
    deleted_saneaia = 0
    deleted_gestao = 0

    try:
        conn3 = sqlite3.connect(DB_PROJETO_3)
        c3 = conn3.cursor()
        c3.execute("DELETE FROM solicitacoes WHERE ss = ? OR os_numero = ?", (TEST_SS_NUMBER, TEST_SS_NUMBER))
        deleted_saneaia = c3.rowcount
        conn3.commit()
        conn3.close()
        print(f"  [OK] saneaia.db: {deleted_saneaia} registro(s) excluído(s).")
    except Exception as e:
        print(f"  [ERRO] Falha ao excluir de saneaia.db: {e}")

    try:
        conn1 = sqlite3.connect(DB_PROJETO_1)
        c1 = conn1.cursor()
        c1.execute("DELETE FROM faltadagua_ex WHERE numero_os = ?", (TEST_SS_NUMBER,))
        deleted_gestao = c1.rowcount
        conn1.commit()
        conn1.close()
        print(f"  [OK] database.sqlite: {deleted_gestao} registro(s) excluído(s).")
    except Exception as e:
        print(f"  [ERRO] Falha ao excluir de database.sqlite: {e}")

    # Validação pós-exclusão
    success_clean = True
    try:
        conn3 = sqlite3.connect(DB_PROJETO_3)
        c3 = conn3.cursor()
        c3.execute("SELECT count(*) FROM solicitacoes WHERE ss = ?", (TEST_SS_NUMBER,))
        remain3 = c3.fetchone()[0]
        conn3.close()
        if remain3 > 0:
            print(f"  [ATENÇÃO] Ainda restam {remain3} registros no saneaia.db!")
            success_clean = False
    except Exception:
        pass

    try:
        conn1 = sqlite3.connect(DB_PROJETO_1)
        c1 = conn1.cursor()
        c1.execute("SELECT count(*) FROM faltadagua_ex WHERE numero_os = ?", (TEST_SS_NUMBER,))
        remain1 = c1.fetchone()[0]
        conn1.close()
        if remain1 > 0:
            print(f"  [ATENÇÃO] Ainda restam {remain1} registros no database.sqlite!")
            success_clean = False
    except Exception:
        pass

    if success_clean:
        print(f"  [OK] Confirmação: Todos os registros de teste foram completamente removidos.")
    return success_clean

def main():
    print_header("TESTE DE RECEBIMENTO VIA WEBHOOK EMBASA (TI)")
    print(f"Data/Hora do Teste: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"SS de Teste: {TEST_SS_NUMBER}")
    print(f"Endereço: {PAYLOAD_TESTE['logradouro']} - {PAYLOAD_TESTE['bairro']}")
    
    # Executa os passos
    if not step_1_check_webhook():
        return False

    if not step_2_send_payload():
        return False

    saneaia_ok = step_3_verify_database_saneaia()
    gestao_ok = step_4_verify_database_gestao()

    # Sempre executa o cleanup para nunca deixar lixo
    clean_ok = step_5_cleanup()

    print_header("RESULTADO FINAL DO TESTE")
    if saneaia_ok and gestao_ok and clean_ok:
        print("  🎉 SUCESSO TOTAL!")
        print("  O Webhook recebeu a SS da TI, processou a normalização de colunas,")
        print("  gravou simultaneamente nos bancos do Projeto 1 e do Projeto 3,")
        print("  e em seguida removeu o registro de teste com sucesso.")
        print("  A integração com o setor de TI da EMBASA está 100% OPERACIONAL e SEGURA.")
        return True
    else:
        print("  ⚠️ TESTE CONCLUÍDO COM PENDÊNCIAS:")
        print(f"  - Gravação Projeto 3 (saneaia.db): {'OK' if saneaia_ok else 'FALHA'}")
        print(f"  - Gravação Projeto 1 (database.sqlite): {'OK' if gestao_ok else 'FALHA'}")
        print(f"  - Limpeza dos dados: {'OK' if clean_ok else 'FALHA'}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
