# -*- coding: utf-8 -*-
"""
Serviço de escuta (Webhook) para recebimento unificado de dados da Embasa.
Este script inicia um servidor HTTP na porta 3002.
Ele escuta por requisições POST no endpoint /webhook.
Ele aceita:
  - JSON (array de registros)
  - CSV (transmissão unificada)
  - Multipart/form-data (upload de arquivo)

O script realiza a classificação automática dos serviços em:
  - Falta d'Água Pendente (waterShortage)
  - Falta d'Água Executada (waterShortageEx)
  - Vazamentos (leaks)
  - Pavimentos (pavement)
  - Carro Pipa (waterTruck)

Em seguida, envia os blocos separados para a API Local do Express (porta 3001) para persistência no SQLite.
Por fim, dispara o recálculo dos insights da IA SaneaIA (porta 8000).
"""

import http.server
import json
import os
import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
import io
import csv
import requests
import sqlite3
from datetime import datetime
from urllib.parse import urlparse, parse_qs

# Adiciona o diretório atual ao sys.path para garantir que possamos importar master_extracao
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from master_extracao import reprocessar_analise_preditiva
except ImportError:
    # Fallback caso não consiga importar
    def reprocessar_analise_preditiva():
        print("  [AVISO] Erro: Não foi possível importar a função de recálculo preditivo de master_extracao.")
        pass

PORT = int(os.getenv("WEBHOOK_PORT", 3002))
LOCAL_API_URL = "http://127.0.0.1:3001/api/import-csv"

def normalize_keys(item):
    """
    Normaliza as chaves do dicionário (removendo acentos, espaços e caixa alta)
    para garantir compatibilidade técnica independente do padrão enviado pela TI.
    """
    import unicodedata
    
    # Determina se este item possui a coluna de observação de encerramento
    has_obs_enc = False
    for k in item.keys():
        raw = k.lower().strip()
        norm = unicodedata.normalize('NFD', raw).encode('ascii', 'ignore').decode('utf-8')
        norm = "".join(c for c in norm if c.isalnum())
        if "obseencdaos" in norm or "obsdeenc" in norm or "obsblueprint" in norm or "obsenc" in norm or (("obs" in norm or norm == "enc" or "encerr" in norm) and not "ss" in norm):
            has_obs_enc = True
            break

    normalized = {}
    for k, v in item.items():
        raw = k.lower().strip()
        norm = unicodedata.normalize('NFD', raw).encode('ascii', 'ignore').decode('utf-8')
        norm = "".join(c for c in norm if c.isalnum())
        
        if norm == "ss":
            normalized["ss"] = v
        elif norm in ["os", "numeroos", "numeroosss"]:
            normalized["os_numero"] = v
            if "ss" not in normalized:
                normalized["ss"] = v
        elif "servi" in norm: # "servi" casa com "servico" e "servio"
            normalized["servico"] = v
        elif "matricula" in norm or "matri" in norm or "matrcul" in norm or norm.startswith("matr"): # Evita colisão com última tramitação
            normalized["matricula"] = v
        elif "bairro" in norm:
            normalized["bairro"] = v
        elif "logradouro" in norm:
            normalized["logradouro"] = v
        elif "setor" in norm:
            normalized["setor"] = v
        elif "cep" in norm:
            normalized["cep"] = v
        elif "numimovel" in norm or "numeroimovel" in norm or "imovel" in norm or "num" in norm:
            normalized["num_imovel"] = v
        elif "dtabertura" in norm or "dataabertura" in norm or "abertura" in norm:
            normalized["data_abertura"] = v
        elif "conclus" in norm: # "conclus" casa com "conclusao" e "concluso"
            normalized["data_conclusao"] = v
        elif "observacao" in norm or "obseencdaos" in norm or "obsenc" in norm or (("obs" in norm or norm == "enc" or "encerr" in norm) and not "ss" in norm):
            normalized["observacao"] = v
        elif "sit" in norm or "status" in norm:
            normalized["situacao"] = v
        elif "unidadeatual" in norm or "unidatual" in norm or "unid" in norm:
            normalized["unidade_atual"] = v
        elif "tramitacao" in norm or "datatramitacao" in norm:
            normalized["data_tramitacao"] = v
        elif "localidade" in norm or "local" in norm:
            normalized["localidade"] = v
        elif "obsdass" in norm:
            if has_obs_enc:
                normalized["especificacao"] = v
            else:
                normalized["observacao"] = v
        elif "especifica" in norm:
            if not has_obs_enc:
                normalized["especificacao"] = v
                
    return normalized

def classify_item(item):
    """
    Classifica um registro unificado com base no seu tipo de serviço e situação de execução.
    """
    servico = str(item.get("servico") or "").upper()
    situacao = str(item.get("situacao") or "").upper()
    
    # 1. Vazamentos
    if any(v in servico for v in ["318", "291", "292", "320", "290", "VAZAMENTO", "VAZ"]):
        return "leaks"
    # 2. Reposição de Pavimentos
    elif any(p in servico for p in ["85", "160", "86", "PAVIM", "PAVIMENTO", "RECOMP"]):
        return "pavement"
    # 3. Carro Pipa
    elif any(pt in servico for pt in ["273", "1017", "CARRO PIPA", "PIPA"]) or servico.startswith("6 ") or servico.startswith("6-") or servico.startswith("06"):
        return "waterTruck"
    # 4. Falta d'Água (separa em aberto vs executadas)
    elif any(f in servico for f in ["364", "FALTA AGUA", "FALTA D'AGUA", "ABASTECIMENTO"]):
        # Mapeia "Concluída Executada" e "Concluída Não Executada"
        if any(s in situacao for s in ["CONCLU", "EXEC"]):
            return "waterShortageEx"
        # Mapeia "Aberta" e "Programada" (padrão para ordens ativas)
        else:
            return "waterShortage"
    
    return None

def classify_and_group(items):
    """
    Agrupa uma lista de registros por tipo e gera blocos de CSVs específicos.
    """
    groups = {
        "leaks": [],
        "pavement": [],
        "waterShortage": [],
        "waterShortageEx": [],
        "waterTruck": []
    }
    
    gestao_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "1 - gestoaumb", "database.sqlite"))
    for raw_item in items:
        normalized = normalize_keys(raw_item)
        if not normalized.get("ss"):
            continue

        # Estampa automática e rastreabilidade caso venha do emulador de testes
        is_test = (
            raw_item.get("origem") == "TESTE_EMULADOR_WEBHOOK" or
            "[TESTE" in str(raw_item.get("observacao") or "") or
            "[TESTE" in str(raw_item.get("especificacao") or "") or
            "[TESTE" in str(normalized.get("observacao") or "")
        )
        if is_test:
            obs_curr = str(normalized.get("observacao") or "").strip()
            if not "[TESTE_EMULADOR]" in obs_curr:
                normalized["observacao"] = f"[TESTE_EMULADOR] {obs_curr}" if obs_curr else "[TESTE_EMULADOR] REGISTRO DE HOMOLOGACAO"
            esp_curr = str(normalized.get("especificacao") or "").strip()
            if not "[TESTE_EMULADOR]" in esp_curr:
                normalized["especificacao"] = f"[TESTE_EMULADOR] {esp_curr}" if esp_curr else "[TESTE_EMULADOR] REGISTRO DE HOMOLOGACAO"
            
            # Registra no tracker da Gestão
            if os.path.exists(gestao_db_path):
                try:
                    conn_g = sqlite3.connect(gestao_db_path)
                    cur_g = conn_g.cursor()
                    cur_g.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
                    cur_g.execute("INSERT OR REPLACE INTO webhook_test_tracker VALUES (?, ?)", (str(normalized.get("ss")), datetime.now().isoformat()))
                    conn_g.commit()
                    conn_g.close()
                except Exception:
                    pass
            
        target_type = classify_item(normalized)
        if target_type:
            groups[target_type].append(normalized)
        else:
            print(f"  [AVISO] Registro ignorado (serviço não mapeado): SS {normalized.get('ss')} | {normalized.get('servico')}")
            
    # Cria os CSVs correspondentes
    csv_blocks = {}
    headers = [
        "SS", "Serviço", "Matrícula", "Localidade", "Bairro", "Logradouro", 
        "Nº do Imóvel", "Dt Abertura da SS", "Conclusão da SS", "Obs da SS",
        "Obs de Enc da OS", "Sit da OS", "Unid Atual (OS)", "Data/Hora Última Tramitação da OS"
    ]
    
    for t, group_items in groups.items():
        if not group_items:
            continue
        out = io.StringIO()
        # Separador ponto-e-vírgula clássico do SCI Web
        out.write(";".join(headers) + "\n")
        for item in group_items:
            row = [
                str(item.get("ss") or ""),
                str(item.get("servico") or ""),
                str(item.get("matricula") or ""),
                str(item.get("localidade") or ""),
                str(item.get("bairro") or ""),
                str(item.get("logradouro") or ""),
                str(item.get("num_imovel") or ""),
                str(item.get("data_abertura") or ""),
                str(item.get("data_conclusao") or ""),
                str(item.get("especificacao") or ""),
                str(item.get("observacao") or ""),
                str(item.get("situacao") or ""),
                str(item.get("unidade_atual") or ""),
                str(item.get("data_tramitacao") or "")
            ]
            row = [r.replace("\n", " ").replace(";", " ") for r in row]
            out.write(";".join(row) + "\n")
        csv_blocks[t] = out.getvalue()
        
    return csv_blocks

def insert_into_saneaia_db(items):
    """
    Insere TODOS os registros e TODOS os serviços, sem filtros ou classificações,
    diretamente na tabela 'solicitacoes' do banco SQLite do Projeto 3 (saneaia.db).
    Remove registros duplicados pelo número da Solicitação (SS) antes de inserir.
    """
    saneaia_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "3 - Saneaia", "database", "saneaia.db"))
    if not os.path.exists(saneaia_db_path):
        print(f"  [AVISO] Aviso: Banco de dados SaneaIA não encontrado em {saneaia_db_path}")
        return
        
    try:
        conn = sqlite3.connect(saneaia_db_path)
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
        
        inserted_count = 0
        for raw_item in items:
            item = normalize_keys(raw_item)
            ss = str(item.get("ss") or "").strip()
            if not ss:
                continue
                
            # Rastreamento de teste no saneaia.db
            is_test = (
                raw_item.get("origem") == "TESTE_EMULADOR_WEBHOOK" or
                "[TESTE" in str(raw_item.get("observacao") or "") or
                "[TESTE" in str(raw_item.get("especificacao") or "") or
                "[TESTE" in str(item.get("observacao") or "") or
                "[TESTE" in str(item.get("especificacao") or "")
            )
            if is_test:
                cursor.execute("INSERT OR REPLACE INTO webhook_test_tracker VALUES (?, ?)", (ss, datetime.now().isoformat()))
                obs_curr = str(item.get("observacao") or "").strip()
                if not "[TESTE_EMULADOR]" in obs_curr:
                    item["observacao"] = f"[TESTE_EMULADOR] {obs_curr}" if obs_curr else "[TESTE_EMULADOR] REGISTRO DE HOMOLOGACAO"
                esp_curr = str(item.get("especificacao") or "").strip()
                if not "[TESTE_EMULADOR]" in esp_curr:
                    item["especificacao"] = f"[TESTE_EMULADOR] {esp_curr}" if esp_curr else "[TESTE_EMULADOR] REGISTRO DE HOMOLOGACAO"

            # Deleta duplicado para garantir idempotência (UPSERT)
            cursor.execute("DELETE FROM solicitacoes WHERE ss = ? OR os_numero = ?", (ss, ss))
            
            # Tenta determinar o mês
            data_abertura = str(item.get("data_abertura") or "")
            mes_nome = ""
            if data_abertura and "/" in data_abertura:
                try:
                    parts = data_abertura.split("/")
                    if len(parts) > 1:
                        mes_num = int(parts[1])
                        meses = [
                            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                        ]
                        mes_nome = meses[mes_num - 1]
                except Exception:
                    pass
            
            data_abertura = str(item.get("data_abertura") or "").strip()
            created_at_val = data_abertura if data_abertura else datetime.now().strftime('%d/%m/%Y %H:%M:%S')

            sql = """
            INSERT INTO solicitacoes (
                ss, os_numero, especificacao, servico, unidade_os, 
                matricula, bairro, logradouro, cep, data_encerramento, 
                observacao, situacao, data_ultima_tramitacao, localidade, mes, created_at, setor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            os_num = str(item.get("os_numero") or ss).strip()
            cep_val = str(item.get("cep") or item.get("num_imovel") or "").strip()
            cursor.execute(sql, (
                ss,
                os_num,
                str(item.get("especificacao") or ""),
                str(item.get("servico") or ""),
                str(item.get("unidade_atual") or ""),
                str(item.get("matricula") or ""),
                str(item.get("bairro") or ""),
                str(item.get("logradouro") or ""),
                cep_val,
                str(item.get("data_conclusao") or ""),
                str(item.get("observacao") or ""),
                str(item.get("situacao") or ""),
                str(item.get("data_tramitacao") or ""),
                str(item.get("localidade") or ""),
                mes_nome,
                created_at_val,
                str(item.get("setor") or "")
            ))
            inserted_count += 1
            
        conn.commit()
        print(f"  [OK] {inserted_count} registros gravados com sucesso em saneaia.db (Projeto 3).")
    except Exception as e:
        print(f"  [AVISO] Erro ao salvar no saneaia.db: {e}")
    finally:
        conn.close()

def parse_csv_to_items(csv_text):
    """
    Converte texto CSV bruto em lista de dicionários contendo os cabeçalhos.
    """
    separator = ";" if ";" in csv_text else ("," if "," in csv_text else "\t")
    f = io.StringIO(csv_text)
    reader = csv.reader(f, delimiter=separator)
    try:
        headers = next(reader)
    except StopIteration:
        return []
        
    items = []
    for row in reader:
        if not row:
            continue
        item = {}
        for idx, val in enumerate(row):
            if idx < len(headers):
                item[headers[idx]] = val
        items.append(item)
    return items

def parse_and_classify_csv(csv_text):
    """
    Lê o CSV, alimenta o saneaia.db (Projeto 3) e depois agrupa os registros para o Projeto 1.
    """
    items = parse_csv_to_items(csv_text)
    if items:
        print("  [PASSO 1] Alimentando o Projeto 3 (saneaia.db) com os dados brutos...")
        insert_into_saneaia_db(items)
    print("  [PASSO 2] Separando e classificando os blocos para o Projeto 1...")
    return classify_and_group(items)

class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_error_response(self, message):
        self.send_response(400)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}, ensure_ascii=False).encode('utf-8'))

    PURGE_AUTH_TOKEN = "UMBMAS_PURGE_SEC_AUTH_9841"

    def handle_purge_test(self):
        """
        Rotina blindada de expurgo de dados de teste / homologação.
        Exige token de autorização e utiliza queries parametrizadas (zero SQL Injection).
        Inspeciona o schema de cada tabela para evitar falhas em colunas inexistentes.
        """
        # 1. Validação de Segurança contra requisições não autorizadas
        req_token = self.headers.get("X-Purge-Auth", "").strip()
        auth_ok = (req_token == self.PURGE_AUTH_TOKEN)
        
        if not auth_ok:
            try:
                length = int(self.headers.get('Content-Length', 0))
                if length > 0:
                    body = json.loads(self.rfile.read(length).decode('utf-8'))
                    if body.get("token") == self.PURGE_AUTH_TOKEN or body.get("auth_token") == self.PURGE_AUTH_TOKEN:
                        auth_ok = True
            except Exception:
                pass

        if not auth_ok:
            print("  [SEGURANÇA] Tentativa de expurgo negada: Token inválido ou ausente.")
            self.send_response(403)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": "Acesso negado: Token de autorização inválido para expurgo de dados.",
                "status": "forbidden"
            }, ensure_ascii=False).encode('utf-8'))
            return

        saneaia_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "3 - Saneaia", "database", "saneaia.db"))
        gestao_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "1 - gestoaumb", "database.sqlite"))
        
        del_saneaia = 0
        del_gestao = 0
        
        # Lista estrita e fixa de SSs de teste de homologação conhecidas
        KNOWN_TEST_SS = [
            '960012345', '959979459', '960000001', '960000002', '960098765', 
            '9999999999', '9999999998', '9999999901'
        ]

        # 2. Expurgo Seguro no SaneaIA (solicitacoes)
        if os.path.exists(saneaia_path):
            try:
                conn = sqlite3.connect(saneaia_path)
                cur = conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
                cur.execute("SELECT ss FROM webhook_test_tracker")
                tracker_ss = [r[0] for r in cur.fetchall()]
                
                all_test_ss = list(set(KNOWN_TEST_SS + tracker_ss))
                ph = ",".join("?" for _ in all_test_ss)
                
                # Executa DELETE 100% parametrizado
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
            except Exception as e:
                print(f"  [AVISO] Erro durante expurgo no saneaia.db: {e}")
                
        # 3. Expurgo Seguro no Projeto 1 (database.sqlite) - Schema-Aware
        if os.path.exists(gestao_path):
            try:
                conn = sqlite3.connect(gestao_path)
                cur = conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS webhook_test_tracker (ss TEXT PRIMARY KEY, criado_em TEXT)")
                cur.execute("SELECT ss FROM webhook_test_tracker")
                tracker_ss_gestao = [r[0] for r in cur.fetchall()]
                
                all_test_ss = list(set(KNOWN_TEST_SS + tracker_ss_gestao))
                ph = ",".join("?" for _ in all_test_ss)
                
                tables = ['faltadagua', 'faltadagua_ex', 'vazamentos', 'pavimentos', 'carropipa', 'ai_insights_faltadagua']
                for tbl in tables:
                    # Inspeciona as colunas da tabela dinamicamente para evitar erro de coluna inexistente
                    cur.execute(f"PRAGMA table_info({tbl})")
                    cols = [c[1] for c in cur.fetchall()]
                    
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
                    del_gestao += cur.rowcount

                cur.execute("DELETE FROM webhook_test_tracker")
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"  [AVISO] Erro durante expurgo no database.sqlite: {e}")
                
        print(f"  [EXPURGO] Testes removidos -> SaneaIA: {del_saneaia} | Gestão: {del_gestao}")
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({
            "message": "Registros de teste expurgados com sucesso",
            "excluidos_saneaia": del_saneaia,
            "excluidos_gestao": del_gestao,
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Purge-Auth')
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path in ["/status", "/", "/webhook"]:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "service": "UMBMAS Webhook Receiver (Embasa)",
                "endpoint": "/webhook",
                "metodo_esperado": "POST",
                "autenticacao": "Nenhuma KEY necessaria (Acesso liberado na rede interna)",
                "content_types_aceitos": ["application/json", "text/csv"],
                "mensagem": "Webhook operacional e pronto para receber cargas de dados via POST.",
                "timestamp": datetime.now().isoformat(),
                "porta": PORT
            }, ensure_ascii=False, indent=2).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path == "/purge-test":
            self.handle_purge_test()
            return

        if parsed_url.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        content_type = self.headers.get('Content-Type', '')
        content_length = int(self.headers.get('Content-Length', 0))

        print(f"\n[RECEBIMENTO] Novo push unificado recebido | Tamanho: {content_length} bytes")
        body_bytes = self.rfile.read(content_length)

        csv_blocks = {}

        if 'application/json' in content_type:
            try:
                data_json = json.loads(body_bytes.decode('utf-8'))
                if not isinstance(data_json, list):
                    data_json = [data_json]
                print("  [PASSO 1] Alimentando o Projeto 3 (saneaia.db) com os dados JSON brutos...")
                insert_into_saneaia_db(data_json)
                print("  [PASSO 2] Separando e classificando os blocos para o Projeto 1...")
                csv_blocks = classify_and_group(data_json)
            except Exception as e:
                print(f"  [AVISO] Erro ao parsear JSON: {e}")
                self.send_error_response(f"Erro no JSON: {str(e)}")
                return
        else:
            # Tenta decodificar como texto (CSV unificado ou Multipart)
            try:
                body_text = body_bytes.decode('utf-8', errors='ignore')
            except Exception as e:
                self.send_error_response(f"Erro ao ler corpo de texto: {str(e)}")
                return

            if 'multipart/form-data' in content_type:
                # Extrai o arquivo CSV do multipart de forma robusta
                boundary = ""
                for part in content_type.split(';'):
                    if 'boundary=' in part:
                        boundary = part.split('boundary=')[1].strip()
                if boundary:
                    parts = body_text.split('--' + boundary)
                    csv_text = ""
                    for p in parts:
                        if 'filename=' in p or 'Content-Type: text/csv' in p or 'Content-Type: application/octet-stream' in p:
                            subparts = p.split('\r\n\r\n', 1)
                            if len(subparts) > 1:
                                csv_text = subparts[1].rsplit('\r\n', 1)[0]
                                break
                    if csv_text:
                        body_text = csv_text
                    else:
                        for p in parts:
                            if '\r\n\r\n' in p:
                                content = p.split('\r\n\r\n', 1)[1].rsplit('\r\n', 1)[0]
                                if 'SS;' in content or 'SS,' in content:
                                    body_text = content
                                    break

            try:
                csv_blocks = parse_and_classify_csv(body_text)
            except Exception as e:
                print(f"  [AVISO] Erro ao ler CSV: {e}")
                self.send_error_response(f"Erro ao decodificar CSV: {str(e)}")
                return

        # Sincroniza e envia cada bloco classificado para o Express Backend Local (SQLite)
        if not csv_blocks:
            print("  [AVISO] Nenhum registro válido classificado no payload.")
            self.send_error_response("Nenhum registro correspondente a serviços mapeados foi identificado.")
            return

        success_count = 0
        water_shortage_updated = False

        for data_type, csv_content in csv_blocks.items():
            if not csv_content:
                continue
            
            filename = f"webhook_{data_type}_{int(datetime.now().timestamp())}.csv"
            files = {'file': (filename, csv_content.encode('utf-8'), 'text/csv')}
            
            try:
                print(f"  [ENVIANDO] {data_type} para a API local (SQLite)...")
                resp = requests.post(
                    LOCAL_API_URL,
                    data={"type": data_type},
                    files=files,
                    timeout=60
                )
                if resp.status_code == 200:
                    success_count += 1
                    print(f"    [OK] {data_type} persistido com sucesso.")
                    if data_type in ["waterShortage", "waterShortageEx"]:
                        water_shortage_updated = True
                else:
                    print(f"    [AVISO] Erro {resp.status_code} ao salvar {data_type}: {resp.text.strip()}")
            except Exception as e:
                print(f"    [AVISO] Falha de requisição ao salvar {data_type}: {e}")

        # Se houveram modificações de falta d'água, dispara recálculo de IA
        if water_shortage_updated:
            print("  [INTEGRAÇÃO] Atualizando análises preditivas do SaneaIA...")
            reprocessar_analise_preditiva()

        self.send_response(200 if success_count > 0 else 500)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            "message": "Push unificado processado",
            "classificacoes_salvas": list(csv_blocks.keys()),
            "sucesso": success_count > 0
        }, ensure_ascii=False).encode('utf-8'))

def run_server():
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, WebhookHandler)
    print("=" * 60)
    print(f" UMBMAS Webhook Receiver unificado - ATIVO")
    print(f" Desenvolvido por: Gleisson Santos - Embasa UMB")
    print(f" Bind: 0.0.0.0 (Escuta todas as placas de rede)")
    print(f" Porta: {PORT}")
    print(f" Endpoint: http://localhost:{PORT}/webhook")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor webhook finalizado.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
