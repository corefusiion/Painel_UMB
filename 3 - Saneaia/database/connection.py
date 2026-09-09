import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'saneaia.db')
GESTAO_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '1 - gestoaumb', 'database.sqlite'))

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

class SupabaseClient:
    """Mock do Cliente Supabase que integra SQLite Local Saneaia + SQLite Gestão UMB."""

    def __init__(self):
        self.base_url = "local-sqlite"
        self.headers = {}

    def _get_conn(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = dict_factory
        return conn

    # --- Async methods (for FastAPI routes) ---
    async def get(self, table: str, params: dict = None) -> list:
        return self.get_sync(table, params)

    async def post(self, table: str, data: dict | list) -> list:
        return self.post_sync(table, data)

    async def patch(self, table: str, data: dict, params: dict) -> list:
        raise NotImplementedError("Patch not implemented in mock")

    async def rpc(self, function_name: str, params: dict = None) -> any:
        return []

    # --- Sync methods (for ML pipeline) ---
    def get_sync(self, table: str, params=None) -> list:
        conn = self._get_conn()
        try:
            filters = {}
            if params:
                if isinstance(params, dict):
                    filters = params
                elif isinstance(params, (list, tuple)):
                    for item in params:
                        if isinstance(item, (list, tuple)) and len(item) == 2:
                            filters[item[0]] = item[1]

            select = "*"
            if "select" in filters:
                select = filters["select"]

            query = f"SELECT {select} FROM {table}"
            where_clauses = []
            where_vals = []

            for key, val in filters.items():
                if key in ("select", "limit", "offset", "order"):
                    continue
                if isinstance(val, str) and "." in val and val.split(".")[0] in key:
                    continue
                if isinstance(val, str) and "=" in val:
                    parts = val.split("=", 1)
                    op = parts[0]
                    value = parts[1] if len(parts) > 1 else ""
                    if op == "eq":
                        where_clauses.append(f"{key} = ?")
                        where_vals.append(value)
                    elif op == "gt":
                        where_clauses.append(f"{key} > ?")
                        where_vals.append(value)
                    elif op == "gte":
                        where_clauses.append(f"{key} >= ?")
                        where_vals.append(value)
                    elif op == "lt":
                        where_clauses.append(f"{key} < ?")
                        where_vals.append(value)
                    elif op == "lte":
                        where_clauses.append(f"{key} <= ?")
                        where_vals.append(value)
                elif isinstance(val, str) and val.startswith("not.is.null"):
                    where_clauses.append(f"{key} IS NOT NULL")
                elif isinstance(val, str) and val.startswith("ilike."):
                    pattern = val.replace("ilike.", "")
                    if key == "bairro_nome":
                        where_clauses.append("bairro LIKE ?")
                        where_vals.append(pattern)
                    else:
                        where_clauses.append(f"{key} LIKE ?")
                        where_vals.append(pattern)
                elif isinstance(val, str) and val.startswith("eq."):
                    where_clauses.append(f"{key} = ?")
                    where_vals.append(val[3:])

            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)

            order = filters.get("order", "")
            if order:
                order_parts = []
                for o in order.split(","):
                    o = o.strip()
                    if not o: continue
                    if "." in o:
                        col, direction = o.split(".", 1)
                        direction = direction.upper()
                        if direction in ("ASC", "DESC"):
                            order_parts.append(f"{col} {direction}")
                        else:
                            order_parts.append(col)
                    else:
                        order_parts.append(o)
                if order_parts:
                    query += " ORDER BY " + ", ".join(order_parts)

            if "limit" in filters:
                query += f" LIMIT {int(filters['limit'])}"

            cursor = conn.cursor()
            results = []
            try:
                cursor.execute(query, where_vals)
                results = cursor.fetchall()
            except Exception as e:
                print(f"[DB MOCK] Erro na tabela saneaia '{table}': {e}")
                results = []

            # 🚀 INTEGRAÇÃO MAGISTRAL: Buscar também na base ativa do Gestão UMB (database.sqlite)
            if os.path.exists(GESTAO_DB_PATH) and table == "solicitacoes":
                try:
                    gestao_conn = sqlite3.connect(GESTAO_DB_PATH)
                    gestao_conn.row_factory = dict_factory
                    g_cursor = gestao_conn.cursor()

                    # Mapear busca de ilike ou eq para faltadagua e faltadagua_ex
                    logr_like = None
                    mat_eq = None
                    bairro_like = None

                    for k, v in filters.items():
                        if k == "logradouro" and isinstance(v, str) and "ilike." in v:
                            logr_like = v.replace("ilike.", "")
                        if (k == "bairro_nome" or k == "bairro") and isinstance(v, str) and "ilike." in v:
                            bairro_like = v.replace("ilike.", "")
                        if k == "matricula" and isinstance(v, str) and "eq." in v:
                            mat_eq = v.replace("eq.", "")

                    g_where = []
                    g_vals = []
                    if logr_like:
                        g_where.append("logradouro LIKE ?")
                        g_vals.append(logr_like)
                    if bairro_like:
                        g_where.append("(bairro_nome LIKE ? OR bairro_codigo LIKE ?)")
                        g_vals.extend([bairro_like, bairro_like])
                    if mat_eq:
                        g_where.append("(matricula = ? OR numero_os = ?)")
                        g_vals.extend([mat_eq, mat_eq])

                    if g_where:
                        g_sql_fd = f"SELECT id, numero_os, logradouro, bairro_nome, especificacao as observacao, criado_em as data_inicio, criado_em as data_encerramento FROM faltadagua WHERE " + " AND ".join(g_where)
                        g_cursor.execute(g_sql_fd, g_vals)
                        fd_rows = g_cursor.fetchall()

                        g_sql_ex = f"SELECT id, numero_os, logradouro, bairro_nome, especificacao as observacao, criado_em as data_inicio, data_tramitacao as data_encerramento FROM faltadagua_ex WHERE " + " AND ".join(g_where)
                        g_cursor.execute(g_sql_ex, g_vals)
                        ex_rows = g_cursor.fetchall()

                        # Unificar resultados sem duplicados de ID ou OS
                        existing_ids = {r.get("id") for r in results if r.get("id")}
                        existing_os = {r.get("numero_os") or r.get("os_numero") or r.get("ss") for r in results}
                        existing_os.discard(None)
                        existing_os.discard("")
                        
                        for r in fd_rows + ex_rows:
                            r_id = r.get("id")
                            r_os = r.get("numero_os") or r.get("os_numero") or r.get("ss")
                            
                            if (r_id and r_id in existing_ids) or (r_os and r_os in existing_os):
                                continue
                                
                            results.append(r)
                            if r_id: existing_ids.add(r_id)
                            if r_os: existing_os.add(r_os)

                    gestao_conn.close()
                except Exception as g_err:
                    print(f"[DB MOCK] Aviso ao consultar GestaoUMB DB: {g_err}")

            return results
        finally:
            conn.close()

    def post_sync(self, table: str, data: dict | list) -> list:
        if not data: return []
        if isinstance(data, dict): data = [data]
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            keys = list(data[0].keys())
            cols = ",".join(keys)
            vals = ",".join(["?"] * len(keys))
            sql = f"INSERT INTO {table} ({cols}) VALUES ({vals})"
            for row in data:
                cursor.execute(sql, [row.get(k) for k in keys])
            conn.commit()
            return data
        finally:
            conn.close()

def setup_chat_tables():
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            pinned INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            message_count INTEGER DEFAULT 0,
            last_message_preview TEXT
        );
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            metadata TEXT,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversation_memory (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            summary TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        """)
        conn.commit()
    except Exception as e:
        print(f"[DB SETUP] Erro ao criar tabelas de chat: {e}")
    finally:
        conn.close()

def get_supabase_client() -> SupabaseClient:
    return SupabaseClient()

def test_connection() -> bool:
    try:
        setup_chat_tables()
        client = SupabaseClient()
        data = client.get_sync("solicitacoes", {"limit": "1"})
        print(f"[OK] Conexao SQLite OK")
        return True
    except Exception as e:
        print(f"[ERRO] Erro SQLite: {e}")
        return False
