# -*- coding: utf-8 -*-
"""
UMBMAS - Gerenciador Central de Extração e Inteligência Operacional (ExtractionManager)
====================================================================================
Controla as rotinas de extração em segundo plano com execução headless, transmissão
de logs em tempo real via Server-Sent Events (SSE), monitoramento de impacto no banco
de dados SQLite (Gestão e SaneaIA), agendamento automático e cancelamento seguro.
"""

import os
import sys
import time
import json
import sqlite3
import threading
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from loguru import logger

# Garantir importação dos módulos da Pasta 2 (extracao_pendencias)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXTRACTION_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '2 - extracao_pendencias'))
if EXTRACTION_DIR not in sys.path:
    sys.path.insert(0, EXTRACTION_DIR)

SANEAIA_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
DB_SANEAIA = os.path.join(SANEAIA_DIR, 'database', 'saneaia.db')
DB_GESTAO = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '1 - gestoaumb', 'database.sqlite'))

ROUTINE_NAMES = {
    "ciclo_completo": "Extração Única Completa",
    "executadas": "Apenas Executadas + Detalhes",
    "pendencias": "Apenas Pendências + IA Preditiva",
    "detalhes_isolado": "Atualizar Detalhes das SS (Isolado)",
    "preditiva": "Recálculo da Análise Preditiva (IA)",
}


class StreamLogger:
    """Intercepta stdout/stderr durante a execução da extração e repassa ao manager."""
    def __init__(self, manager, original_stream):
        self.manager = manager
        self.original_stream = original_stream
        self._line_buffer = ""

    def write(self, text):
        if not text:
            return
        # Mantém a saída original no terminal/console
        try:
            self.original_stream.write(text)
            self.original_stream.flush()
        except Exception:
            pass

        self._line_buffer += text
        while "\n" in self._line_buffer:
            line, self._line_buffer = self._line_buffer.split("\n", 1)
            line = line.rstrip("\r")
            if line:
                self.manager.emit_log_line(line)

    def flush(self):
        try:
            self.original_stream.flush()
        except Exception:
            pass
        if self._line_buffer.strip():
            self.manager.emit_log_line(self._line_buffer.strip())
            self._line_buffer = ""


class ExtractionManager:
    _instance = None
    _singleton_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = super(ExtractionManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._lock = threading.RLock()
        self._cancel_event = threading.Event()
        self._current_thread: Optional[threading.Thread] = None
        self._active_job: Optional[Dict[str, Any]] = None
        
        # Buffer de logs recentes (últimas 1000 linhas)
        self._recent_logs: List[Dict[str, Any]] = []
        
        # Filas assíncronas para SSE (Server-Sent Events)
        self._subscribers: List[asyncio.Queue] = []
        self._subscribers_lock = threading.Lock()
        self._async_loop: Optional[asyncio.AbstractEventLoop] = None

        # Agendador interno
        self._scheduler_enabled = False
        self._scheduler_interval_minutes = 60
        self._scheduler_routine = "ciclo_completo"
        self._next_scheduled_run: Optional[datetime] = None
        self._last_scheduled_run: Optional[datetime] = None
        self._scheduler_stop_event = threading.Event()
        self._scheduler_thread: Optional[threading.Thread] = None

        self._init_history_db()
        self._start_scheduler_loop()
        self._initialized = True
        logger.info("[ExtractionManager] Inicializado com sucesso.")

    def set_async_loop(self, loop: asyncio.AbstractEventLoop):
        """Define o loop assíncrono principal do FastAPI para despachar eventos SSE com segurança."""
        self._async_loop = loop

    def _init_history_db(self):
        """Garante que a tabela de histórico exista no banco saneaia.db."""
        try:
            os.makedirs(os.path.dirname(DB_SANEAIA), exist_ok=True)
            conn = sqlite3.connect(DB_SANEAIA)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS extraction_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT UNIQUE,
                    routine TEXT,
                    routine_name TEXT,
                    periodo TEXT,
                    headless INTEGER DEFAULT 1,
                    status TEXT,
                    stage TEXT,
                    progresso_pct INTEGER DEFAULT 0,
                    start_time TEXT,
                    end_time TEXT,
                    duration_seconds REAL DEFAULT 0,
                    records_found INTEGER DEFAULT 0,
                    records_processed INTEGER DEFAULT 0,
                    records_new INTEGER DEFAULT 0,
                    records_updated INTEGER DEFAULT 0,
                    records_errors INTEGER DEFAULT 0,
                    db_impact TEXT,
                    logs TEXT,
                    error_message TEXT
                )
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"[ExtractionManager] Erro ao inicializar extraction_history: {e}")

    # =========================================================================
    # CONTAGENS E MONITORAMENTO DO IMPACTO NO BANCO DE DADOS
    # =========================================================================
    def get_database_snapshot(self) -> Dict[str, Dict[str, int]]:
        """Lê contagens de registros atuais nas tabelas de ambos os bancos."""
        snapshot = {
            "gestao": {},
            "saneaia": {}
        }

        # 1. Banco Gestão (1 - gestoaumb/database.sqlite)
        if os.path.exists(DB_GESTAO):
            try:
                db_g_path = os.path.abspath(DB_GESTAO).replace('\\', '/')
                conn_g = sqlite3.connect(f"file:{db_g_path}?mode=ro", uri=True, timeout=2)
                cur_g = conn_g.cursor()
                tabelas_gestao = [
                    "faltadagua", "faltadagua_ex", "detalhes_os", 
                    "vazamentos", "pavimentos", "carropipa", "ai_insights_faltadagua"
                ]
                for tbl in tabelas_gestao:
                    try:
                        cur_g.execute(f"SELECT COUNT(*) FROM {tbl}")
                        snapshot["gestao"][tbl] = cur_g.fetchone()[0]
                    except Exception:
                        snapshot["gestao"][tbl] = 0
                conn_g.close()
            except Exception as eg:
                logger.warning(f"[ExtractionManager] Falha ao ler DB Gestão: {eg}")

        # 2. Banco SaneaIA (3 - Saneaia/database/saneaia.db)
        if os.path.exists(DB_SANEAIA):
            try:
                db_s_path = os.path.abspath(DB_SANEAIA).replace('\\', '/')
                conn_s = sqlite3.connect(f"file:{db_s_path}?mode=ro", uri=True, timeout=2)
                cur_s = conn_s.cursor()
                tabelas_saneaia = ["solicitacoes", "detalhes_os", "conversations", "messages"]
                for tbl in tabelas_saneaia:
                    try:
                        cur_s.execute(f"SELECT COUNT(*) FROM {tbl}")
                        snapshot["saneaia"][tbl] = cur_s.fetchone()[0]
                    except Exception:
                        snapshot["saneaia"][tbl] = 0
                conn_s.close()
            except Exception as es:
                logger.warning(f"[ExtractionManager] Falha ao ler DB SaneaIA: {es}")

        return snapshot

    def calculate_db_impact(self, before: Dict[str, Dict[str, int]], after: Dict[str, Dict[str, int]]) -> Dict[str, Any]:
        """Calcula o diferencial de linhas entre o antes e depois da rotina."""
        impact = {
            "gestao": {},
            "saneaia": {},
            "resumo_total_novos": 0
        }

        total_novos = 0
        for db_key in ["gestao", "saneaia"]:
            b_tables = before.get(db_key, {})
            a_tables = after.get(db_key, {})
            all_tables = sorted(list(set(list(b_tables.keys()) + list(a_tables.keys()))))
            for tbl in all_tables:
                cnt_b = b_tables.get(tbl, 0)
                cnt_a = a_tables.get(tbl, 0)
                diff = cnt_a - cnt_b
                impact[db_key][tbl] = {
                    "antes": cnt_b,
                    "depois": cnt_a,
                    "delta": diff
                }
                if diff > 0 and tbl not in ("conversations", "messages"):
                    total_novos += diff

        impact["resumo_total_novos"] = total_novos
        return impact

    # =========================================================================
    # GESTÃO DE LOGS E EVENTOS SSE
    # =========================================================================
    def emit_log_line(self, line: str):
        """Classifica e transmite uma linha de log para os assinantes SSE."""
        if not line:
            return

        now_str = datetime.now().strftime("%H:%M:%S")
        clean_text = line.strip()

        # Classificação visual/semântica do nível de log
        lower = clean_text.lower()
        if "✗" in clean_text or "❌" in clean_text or "erro" in lower or "falha" in lower or "exception" in lower:
            level = "error"
        elif "✓" in clean_text or "✨" in clean_text or "sucesso" in lower or "concluído" in lower or "concluida" in lower:
            level = "success"
        elif "⚠" in clean_text or "aviso" in lower or "alerta" in lower:
            level = "warning"
        elif clean_text.startswith("[FASE") or clean_text.startswith("🚀") or clean_text.startswith("🎯") or clean_text.startswith("="):
            level = "stage"
        else:
            level = "info"

        log_entry = {
            "type": "log",
            "timestamp": now_str,
            "level": level,
            "message": clean_text
        }

        # Armazenar no buffer em memória
        with self._lock:
            self._recent_logs.append(log_entry)
            if len(self._recent_logs) > 1500:
                self._recent_logs.pop(0)

            if self._active_job:
                self._active_job["logs"].append(log_entry)
                if level == "error":
                    self._active_job["records_errors"] += 1

        self._broadcast_event(log_entry)

    def update_progress(self, data: Dict[str, Any]):
        """Atualiza a etapa e porcentagem do job ativo e notifica via SSE."""
        with self._lock:
            if not self._active_job:
                return

            if "etapa" in data:
                self._active_job["stage"] = data["etapa"]
            if "progresso_pct" in data:
                self._active_job["progresso_pct"] = data["progresso_pct"]

            stats = data.get("stats")
            if stats and isinstance(stats, dict):
                self._active_job["records_found"] = stats.get("total_sem_detalhes", self._active_job["records_found"])
                self._active_job["records_processed"] = stats.get("processadas", self._active_job["records_processed"])
                self._active_job["records_new"] = stats.get("sucesso", self._active_job["records_new"])
                self._active_job["records_errors"] = stats.get("erros", self._active_job["records_errors"])

            job_copy = self._get_active_job_summary()

        self._broadcast_event({
            "type": "progress",
            "job": job_copy
        })

    def _broadcast_event(self, event_data: Dict[str, Any]):
        """Despacha evento JSON para todas as conexões SSE ativas."""
        with self._subscribers_lock:
            if not self._subscribers:
                return

            loop = self._async_loop
            dead_queues = []
            for q in self._subscribers:
                try:
                    if loop and loop.is_running():
                        loop.call_soon_threadsafe(q.put_nowait, event_data)
                    else:
                        q.put_nowait(event_data)
                except Exception:
                    dead_queues.append(q)

            for dq in dead_queues:
                if dq in self._subscribers:
                    self._subscribers.remove(dq)

    def subscribe(self) -> asyncio.Queue:
        """Cria e registra uma nova fila para streaming SSE."""
        q = asyncio.Queue()
        with self._subscribers_lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Remove a fila SSE após desconexão do cliente."""
        with self._subscribers_lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    # =========================================================================
    # CONTROLE DE EXECUÇÃO DAS ROTINAS (START / STOP)
    # =========================================================================
    def is_running(self) -> bool:
        """Retorna True se houver uma extração ativa no momento."""
        with self._lock:
            return self._active_job is not None and self._active_job.get("status") in ("running", "cancelling")

    def get_status(self) -> Dict[str, Any]:
        """Retorna o estado completo da extração e métricas do job ativo."""
        with self._lock:
            active_info = self._get_active_job_summary()
            scheduler_info = {
                "enabled": self._scheduler_enabled,
                "interval_minutes": self._scheduler_interval_minutes,
                "routine": self._scheduler_routine,
                "next_run": self._next_scheduled_run.isoformat() if self._next_scheduled_run else None,
                "last_run": self._last_scheduled_run.isoformat() if self._last_scheduled_run else None,
            }
            return {
                "is_running": self.is_running(),
                "active_job": active_info,
                "recent_logs": self._recent_logs[-150:],
                "scheduler": scheduler_info,
                "db_snapshot": self.get_database_snapshot()
            }

    def _get_active_job_summary(self) -> Optional[Dict[str, Any]]:
        """Retorna snapshot sem a chave de logs volumosos para tráfego leve."""
        if not self._active_job:
            return None
        d = dict(self._active_job)
        d.pop("logs", None)
        return d

    def start_job(
        self,
        routine: str,
        dt_inicio: Optional[str] = None,
        dt_fim: Optional[str] = None,
        headless: bool = True
    ) -> Dict[str, Any]:
        """Inicia uma rotina de extração em segundo plano."""
        with self._lock:
            if self.is_running():
                raise RuntimeError("Já existe uma extração em andamento. Aguarde a conclusão ou cancele a atual.")

            # Validação do período
            hoje = datetime.now()
            ontem = hoje - timedelta(days=1)
            if not dt_inicio:
                dt_inicio = ontem.strftime("%d/%m/%Y")
            if not dt_fim:
                dt_fim = hoje.strftime("%d/%m/%Y")

            job_id = f"job_{int(time.time())}_{routine}"
            routine_name = ROUTINE_NAMES.get(routine, routine)
            periodo = f"{dt_inicio} a {dt_fim}"

            self._cancel_event.clear()

            self._active_job = {
                "job_id": job_id,
                "routine": routine,
                "routine_name": routine_name,
                "periodo": periodo,
                "dt_inicio": dt_inicio,
                "dt_fim": dt_fim,
                "headless": bool(headless),
                "status": "running",
                "stage": "Inicializando ambiente de extração",
                "progresso_pct": 2,
                "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": None,
                "duration_seconds": 0.0,
                "records_found": 0,
                "records_processed": 0,
                "records_new": 0,
                "records_updated": 0,
                "records_errors": 0,
                "db_impact": {},
                "logs": [],
                "error_message": None
            }

            # Inserir no histórico SQLite imediatamente como running
            self._save_job_history(self._active_job, is_initial=True)

            # Disparar thread de execução desacoplada
            self._current_thread = threading.Thread(
                target=self._run_job_worker,
                args=(job_id, routine, dt_inicio, dt_fim, headless),
                daemon=True,
                name=f"ExtractionWorker-{job_id}"
            )
            self._current_thread.start()

            logger.info(f"[ExtractionManager] Job {job_id} ({routine_name}) iniciado com sucesso.")
            job_copy = self._get_active_job_summary()

        self._broadcast_event({
            "type": "job_started",
            "job": job_copy
        })
        return job_copy

    def stop_job(self) -> Dict[str, Any]:
        """Solicita o cancelamento gracioso da extração em execução."""
        with self._lock:
            if not self.is_running():
                return {"status": "idle", "message": "Nenhuma extração ativa para cancelar."}

            self._cancel_event.set()
            if self._active_job:
                self._active_job["status"] = "cancelling"
                self._active_job["stage"] = "Cancelamento solicitado... Finalizando com segurança"

            self.emit_log_line("[CANCELAMENTO] 🛑 Interrupção solicitada pelo usuário. Encerrando processos...")
            job_copy = self._get_active_job_summary()

        self._broadcast_event({
            "type": "job_cancelling",
            "job": job_copy
        })
        return {"status": "cancelling", "message": "Sinal de cancelamento enviado com sucesso."}

    # =========================================================================
    # WORKER DE EXECUÇÃO EM SEGUNDO PLANO
    # =========================================================================
    def _run_job_worker(self, job_id: str, routine: str, dt_inicio: str, dt_fim: str, headless: bool):
        """Executa a rotina real de automação, captura logs e calcula métricas."""
        start_ts = time.time()
        error_msg = None
        db_before = self.get_database_snapshot()

        # Interceptar stdout e stderr para transmitir ao vivo no SSE
        orig_stdout = sys.stdout
        orig_stderr = sys.stderr
        stream_logger = StreamLogger(self, orig_stdout)

        sys.stdout = stream_logger
        sys.stderr = stream_logger

        try:
            import master_extracao

            self.emit_log_line(f"🚀 [EXTRAÇÃO INICIADA] Rotina: {ROUTINE_NAMES.get(routine, routine)}")
            self.emit_log_line(f"   Período: {dt_inicio} até {dt_fim} | Headless: {headless}")
            self.emit_log_line("-" * 65)

            # Função de callback repassada aos scripts
            def progress_cb(data):
                self.update_progress(data)

            if routine == "ciclo_completo":
                master_extracao.executar_ciclo_completo(
                    dt_inicio=dt_inicio,
                    dt_fim=dt_fim,
                    headless=headless,
                    cancel_event=self._cancel_event,
                    progress_callback=progress_cb
                )
            elif routine == "executadas":
                master_extracao.executar_ciclo_executadas(
                    dt_inicio=dt_inicio,
                    dt_fim=dt_fim,
                    headless=headless,
                    cancel_event=self._cancel_event,
                    progress_callback=progress_cb
                )
            elif routine == "pendencias":
                master_extracao.executar_ciclo_pendencias(
                    dt_inicio=dt_inicio,
                    dt_fim=dt_fim,
                    headless=headless,
                    cancel_event=self._cancel_event,
                    progress_callback=progress_cb
                )
            elif routine == "detalhes_isolado":
                master_extracao.executar_detalhes_isolado(
                    dt_inicio=dt_inicio,
                    dt_fim=dt_fim,
                    headless=headless,
                    cancel_event=self._cancel_event,
                    progress_callback=progress_cb
                )
            elif routine == "preditiva":
                self.update_progress({"etapa": "Calculando Análise Preditiva IA", "progresso_pct": 50})
                master_extracao.reprocessar_analise_preditiva()
                self.update_progress({"etapa": "Análise Preditiva Concluída", "progresso_pct": 100})
            else:
                raise ValueError(f"Rotina desconhecida: {routine}")

            # Status final
            if self._cancel_event.is_set():
                final_status = "cancelled"
                final_stage = "Cancelado pelo usuário"
                self.emit_log_line("\n[CANCELADO] Rotina de extração interrompida com segurança.")
            else:
                final_status = "success"
                final_stage = "Concluído com sucesso"
                self.emit_log_line("\n✨ [FINALIZADO] Extração e processamento concluídos 100% com sucesso!")

        except Exception as exc:
            final_status = "error"
            final_stage = "Erro durante a execução"
            error_msg = str(exc)
            logger.error(f"[ExtractionManager] Falha no job {job_id}: {exc}")
            self.emit_log_line(f"\n❌ [ERRO CRÍTICO] {exc}")
        finally:
            # Restaurar streams do sistema
            stream_logger.flush()
            sys.stdout = orig_stdout
            sys.stderr = orig_stderr

            # Snapshot pós-execução e cálculo de impacto
            db_after = self.get_database_snapshot()
            db_impact = self.calculate_db_impact(db_before, db_after)

            end_ts = time.time()
            duration_sec = round(end_ts - start_ts, 1)

            with self._lock:
                if self._active_job:
                    self._active_job["status"] = final_status
                    self._active_job["stage"] = final_stage
                    self._active_job["progresso_pct"] = 100 if final_status == "success" else self._active_job["progresso_pct"]
                    self._active_job["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self._active_job["duration_seconds"] = duration_sec
                    self._active_job["db_impact"] = db_impact
                    self._active_job["error_message"] = error_msg
                    if db_impact.get("resumo_total_novos", 0) > 0 and self._active_job["records_new"] == 0:
                        self._active_job["records_new"] = db_impact["resumo_total_novos"]

                    # Persistir conclusão no banco de dados SQLite
                    self._save_job_history(self._active_job, is_initial=False)

                    final_summary = self._get_active_job_summary()
                else:
                    final_summary = None

            # Notificar clientes conectados via SSE
            self._broadcast_event({
                "type": "job_finished",
                "job": final_summary,
                "db_impact": db_impact
            })

            logger.info(f"[ExtractionManager] Job {job_id} finalizado: status={final_status}, duração={duration_sec}s")

    # =========================================================================
    # PERSISTÊNCIA NO HISTÓRICO SQLITE
    # =========================================================================
    def _save_job_history(self, job: Dict[str, Any], is_initial: bool = False):
        """Insere ou atualiza o registro na tabela extraction_history."""
        try:
            conn = sqlite3.connect(DB_SANEAIA)
            cursor = conn.cursor()

            logs_text = "\n".join([
                f"[{l.get('timestamp', '')}] [{l.get('level', '').upper()}] {l.get('message', '')}"
                for l in job.get("logs", [])
            ])

            db_impact_json = json.dumps(job.get("db_impact", {}), ensure_ascii=False)

            if is_initial:
                cursor.execute("""
                    INSERT OR REPLACE INTO extraction_history (
                        job_id, routine, routine_name, periodo, headless,
                        status, stage, progresso_pct, start_time, end_time,
                        duration_seconds, records_found, records_processed,
                        records_new, records_updated, records_errors,
                        db_impact, logs, error_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job["job_id"], job["routine"], job["routine_name"], job["periodo"],
                    1 if job["headless"] else 0, job["status"], job["stage"],
                    job["progresso_pct"], job["start_time"], job["end_time"],
                    job["duration_seconds"], job["records_found"], job["records_processed"],
                    job["records_new"], job["records_updated"], job["records_errors"],
                    db_impact_json, logs_text, job["error_message"]
                ))
            else:
                cursor.execute("""
                    UPDATE extraction_history SET
                        status = ?,
                        stage = ?,
                        progresso_pct = ?,
                        end_time = ?,
                        duration_seconds = ?,
                        records_found = ?,
                        records_processed = ?,
                        records_new = ?,
                        records_updated = ?,
                        records_errors = ?,
                        db_impact = ?,
                        logs = ?,
                        error_message = ?
                    WHERE job_id = ?
                """, (
                    job["status"], job["stage"], job["progresso_pct"],
                    job["end_time"], job["duration_seconds"],
                    job["records_found"], job["records_processed"],
                    job["records_new"], job["records_updated"], job["records_errors"],
                    db_impact_json, logs_text, job["error_message"],
                    job["job_id"]
                ))

            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"[ExtractionManager] Falha ao persistir histórico: {e}")

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Recupera os últimos N registros de histórico de extração."""
        history = []
        try:
            conn = sqlite3.connect(DB_SANEAIA)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, job_id, routine, routine_name, periodo, headless,
                       status, stage, progresso_pct, start_time, end_time,
                       duration_seconds, records_found, records_processed,
                       records_new, records_updated, records_errors,
                       db_impact, error_message
                FROM extraction_history
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            for r in rows:
                item = dict(r)
                if item.get("db_impact"):
                    try:
                        item["db_impact"] = json.loads(item["db_impact"])
                    except Exception:
                        pass
                history.append(item)
            conn.close()
        except Exception as e:
            logger.error(f"[ExtractionManager] Falha ao buscar histórico: {e}")
        return history

    def get_history_logs(self, history_id: int) -> str:
        """Recupera o log completo de um registro histórico por ID."""
        try:
            conn = sqlite3.connect(DB_SANEAIA)
            cursor = conn.cursor()
            cursor.execute("SELECT logs FROM extraction_history WHERE id = ?", (history_id,))
            row = cursor.fetchone()
            conn.close()
            if row and row[0]:
                return row[0]
            return "Nenhum log disponível para este registro."
        except Exception as e:
            return f"Erro ao consultar logs históricos: {e}"

    # =========================================================================
    # AGENDADOR AUTOMÁTICO RECORRENTE
    # =========================================================================
    def set_scheduler(self, enabled: bool, interval_minutes: int = 60, routine: str = "ciclo_completo"):
        """Configura e liga/desliga o agendador automático."""
        with self._lock:
            self._scheduler_enabled = enabled
            self._scheduler_interval_minutes = max(5, int(interval_minutes))
            self._scheduler_routine = routine

            if enabled:
                self._next_scheduled_run = datetime.now() + timedelta(minutes=self._scheduler_interval_minutes)
                self.emit_log_line(f"⏱️ [AGENDADOR] Ativado! Próximo ciclo agendado para: {self._next_scheduled_run.strftime('%H:%M:%S')} (intervalo: {self._scheduler_interval_minutes} min)")
            else:
                self._next_scheduled_run = None
                self.emit_log_line("🛑 [AGENDADOR] Desativado pelo operador.")

        self._broadcast_event({
            "type": "scheduler_updated",
            "scheduler": {
                "enabled": self._scheduler_enabled,
                "interval_minutes": self._scheduler_interval_minutes,
                "routine": self._scheduler_routine,
                "next_run": self._next_scheduled_run.isoformat() if self._next_scheduled_run else None,
            }
        })

    def _start_scheduler_loop(self):
        """Inicia a thread leve de vigilância do agendador."""
        def scheduler_worker():
            while not self._scheduler_stop_event.is_set():
                time.sleep(5)
                if not self._scheduler_enabled or not self._next_scheduled_run:
                    continue

                if datetime.now() >= self._next_scheduled_run:
                    if not self.is_running():
                        self.emit_log_line(f"⏰ [AGENDADOR] Disparando execução programada: {self._scheduler_routine}")
                        try:
                            self.start_job(routine=self._scheduler_routine, headless=True)
                            with self._lock:
                                self._last_scheduled_run = datetime.now()
                                self._next_scheduled_run = datetime.now() + timedelta(minutes=self._scheduler_interval_minutes)
                        except Exception as e:
                            logger.error(f"[ExtractionManager] Falha ao disparar job agendado: {e}")
                    else:
                        # Se já estava rodando, posterga 5 minutos para não conflitar
                        self._next_scheduled_run = datetime.now() + timedelta(minutes=5)
                        self.emit_log_line("⏳ [AGENDADOR] Job anterior ainda em execução. Postergando agendamento em 5 minutos...")

        self._scheduler_thread = threading.Thread(target=scheduler_worker, daemon=True, name="ExtractionSchedulerWatcher")
        self._scheduler_thread.start()


# Instância Singleton global
extraction_manager = ExtractionManager()
